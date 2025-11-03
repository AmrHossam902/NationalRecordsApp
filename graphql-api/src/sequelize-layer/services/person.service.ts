import { Op, Sequelize } from "sequelize";
import { PersonModel } from "../models/Person";
import { Person } from "src/gql-layer/models/person.model";
import { PersonService } from "src/gql-layer/person-service.interface";
import { PeoplePage } from "../../gql-layer/interfaces/PeoplePage.interface";
import { MarriageRecord } from "../../gql-layer/models/marriage-record.model";
import { MarriedTo } from "../../gql-layer/models/marriedTo.model";
import { Injectable } from "@nestjs/common";
import { MarriageRecordModel } from "../models/MarriageRecord";
import { Gender, GenderEnum } from "src/gql-layer/scalars/gender.scalar";
import { CreatePersonInput } from "src/gql-layer/inputs/create-person.input";
import { faker } from "@faker-js/faker";
import { MarriageReadError, MarriageReadErrorType } from "src/gql-layer/exceptions/marriageRead.error";
import { UUIDV7 } from "../data-types/UUID7";
import { GeneratorService } from "./generator.service";

@Injectable()
export class PersonServiceSequelize implements PersonService{

    constructor(public genService: GeneratorService ){}  
    
    async createNewPerson(personData: CreatePersonInput) : Promise<Person>{

        let father = await PersonModel.findOne({
            where: {
                ssn: personData.fatherSSN
            }
        })
        if(!father)
            throw Error(`person with ssn ${personData.fatherSSN} is not found`);

        let mother = await PersonModel.findOne({
            where: {
                ssn: personData.motherSSN
            }
        });
        if(!mother)
            throw Error(`person with ssn ${personData.motherSSN} is not found`);            

        console.log(personData);

        return PersonModel.create({
            firstName: personData.firstName,
            lastName: personData.lastName,
            middleName: personData.middleName,
            birthDate: personData.birthDate,
            address: personData.address,
            gender: personData.gender,
            ssn: faker.string.alphanumeric(10),
            father_id: father.id,
            mother_id: mother.id
        })
        .then((personData: PersonModel)=>{
            return this.personModelToPerson(personData);
        });
    }

    getPersonById(id: string): Promise<Person>{
        return PersonModel.findOne({
            where: {
                id
            }
        }).then((personData: PersonModel)=>{
            return this.personModelToPerson(personData);
        });
    }

    async batchGetPersonById(ids: String[]): Promise<(Person|null)[]>{
        return PersonModel.findAll({
            where: {
                id:  { 
                    [Op.in]: ids 
                }
            }
        })
        .then( res=> {
            let result:(Person|null)[] = [];
            ids.forEach((id)=>{
                const foundPerson = res.find((p)=> p.id == id);
                result.push( foundPerson ? this.personModelToPerson(foundPerson) : null );
            });
            return result;
        });
    }

    getPersonBySSN(ssn: String): Promise<Person>{
        
        return PersonModel.findOne({
            where: {
                ssn
            }
        }).then((personData: PersonModel)=>{
            return this.personModelToPerson(personData);
        });
    }
    
    getAllPeople(
            after: string, //json
            before: string, //json
            sort:[string, string][],
            limit: number,
            filters: Record<string, any>,
            search: string
        ): Promise<PeoplePage>{
        
        //validate limit
        if(!limit || !(+limit) )
            limit = 10;
        if(limit < 1)
            throw Error("limit should be a valid positive integer");

        if(limit > 100)
            throw Error("limit can only be less than 100")

        //validate sort array
        sort = this.validateSortArray(sort);

        
        //building pagination clause
        let paginationCondition; 
        let cursorObj;
        if(after){
            cursorObj = this.validateCursorParams(after, sort);
            paginationCondition = {
                [Op.or] : sort.map(([sortField, dir], index: number)=>{
                    let clause = {};
                    for(let i=0; i< index; i++){
                        clause[sort[i][0]] = cursorObj[sort[i][0]];
                    }

                    clause[sortField] = 
                        ( dir.toLocaleLowerCase() == "asc" ) ?
                            { [Op.gt]: cursorObj[sortField] }:
                            { [Op.lt]: cursorObj[sortField] }

                    return clause;
                })
            
            };
        }
        else if(before){
            cursorObj = this.validateCursorParams(before, sort);
            paginationCondition = {
                [Op.or] : sort.map(([sortField, dir], index: number)=>{
                    let clause = {};
                    for(let i=0; i< index; i++){
                        clause[sort[i][0]] = cursorObj[sort[i][0]];
                    }

                    clause[sortField] = 
                        ( dir.toLocaleLowerCase() == "asc" ) ?
                            { [Op.lt]: cursorObj[sortField] }:
                            { [Op.gt]: cursorObj[sortField] }
                    
                    return clause;
                })
            };

            //reverse sort direction
            sort = sort.map( ([field, dir]) => {
                return [field, (dir.toLowerCase() == "asc") ? "desc" : "asc"]
            });
        }
        else{
            //fetch first page
            cursorObj = {};
            paginationCondition = {};
        }


        //building filter clause
        let filterCondition = {};
        if(filters){

            Object.keys(filters).forEach((key)=>{
                if(filters[key] != undefined){
                    filterCondition[key] = filters[key];
                }
            });
        }

        //building search clause
        let searchCondition = {};
        if(search)
        {
            searchCondition = {
                [Op.or] : [
                    {
                        "firstName" : { [Op.like] : search + "%" }
                    },
                    {
                        "lastName" : { [Op.like] : search + "%" }
                    },
                    {
                        "middleName" : { [Op.like] : search + "%" }
                    },
                    {
                        "ssn" : { [Op.like] : search + "%" }
                    },
                    {
                        "firstAndLastNameQuery" : Sequelize.where(
                            Sequelize.fn(
                                'concat', 
                                Sequelize.col("firstName"),
                                " ",
                                Sequelize.col("lastName")
                            )
                            , 
                            {
                                [Op.like] : search + "%"
                            }
                        )
                    },
                    {
                        "fullNameQuery" : Sequelize.where(
                            Sequelize.fn(
                                'concat', 
                                Sequelize.col("firstName"),
                                " ",
                                Sequelize.col("middleName"),
                                " ",
                                Sequelize.col("lastName")
                            )
                            , 
                            {
                                [Op.like] : search + "%"
                            }
                        )
                    }
                ],
            };
        }
            
        let whereCondition = {
            [Op.and]: [
                filterCondition,
                searchCondition,
                paginationCondition
            ]
        }
        console.log(whereCondition);
   
        return PersonModel.findAll({
            where: {
                ...whereCondition
            },
            order: [...sort],
            limit: limit + 1,
            logging:true
        })
        .then((people: PersonModel[])=>{

            let firstCursor:Record<string,any> = {} 
            let endCursor:Record<string,any> = {};
            let hasMore: boolean = false;
            
            //remove the extra element
            if(people.length > limit){
                people.pop();
                hasMore = true;
            }
            
            //revese the order again in case of before
            if(before && !after){
                people = people.reverse();
            }
                
            //set page cursors
            if(people.length){

                sort.forEach( ([field, dir]: [string, string])=>{
                
                   
                    firstCursor[field] = people[0][field];
                    endCursor[field] = people[people.length -1][field];
                    
                });

                firstCursor["id"] = people[0]["id"]; 
                endCursor["id"] = people[people.length -1]["id"];
            }

            let response = {
                people: people.map((person: PersonModel)=>{
                    return this.personModelToPerson(person);
                })
            }

            if(after){
                if(hasMore)
                    response["next"] = JSON.stringify(endCursor);
                response["prev"] = JSON.stringify(firstCursor)
                
            }
            else if(before){
                response["next"] = JSON.stringify(endCursor);
                if(hasMore)
                    response["prev"] = JSON.stringify(firstCursor);
            }
            else{
                //first page
                if(hasMore)
                    response["next"] = JSON.stringify(endCursor);
            }
              
            return response;
        });
    }

    validateCursorParams( cursor: string, sort: [string, string][]): Record<string, any>{

        let cursorObj: any;
        try {     
            cursorObj = JSON.parse(cursor);
        } catch (error) {
            console.log(error);
            throw Error("Invalid cursor, must be a valid json")    
        }

        if(!cursorObj.id ||  
           ! UUIDV7.isUUIDv7(cursorObj.id)
        )
            throw Error("Invalid cursor, invalid Id field");

        
        cursorObj.id = UUIDV7._stringify(cursorObj.id);


        sort.forEach(( [field, dir]: [string, string]) => {
            
            if(! (field in cursorObj))
                throw Error("Invalid cursor, every sort key must be included in the cursor");

            if( cursorObj[field] == null || cursorObj[field] == undefined)
                throw Error("Invalid cursor, each cursor field must be a non nullish value");

        });

        return cursorObj;

    }

    validateSortArray(sort: [string, string][]) : [string, string][]{
        
        if(!sort)
            return [["id", "asc"]];

        
        let tableCols = Object.keys(PersonModel.getAttributes()); 

        sort.forEach(([item, dir]) =>{
            if(tableCols.indexOf(item) == -1)
                throw Error("invalid sort key");

            if(dir.toLowerCase() != "asc" && dir.toLowerCase() != "desc")
                throw Error("invalid sort direction, use 'asc' or 'desc'");
        });

        sort.push(["id", "asc"]);

        return sort;
    }

    /**
     * get all siblings of a person (full sibling / half sibling )
     * @param p person to get the siblings of
     * @returns 
     */
    async getPersonSiblings(p: Person): Promise<Person[]> {

        let personData: PersonModel | null = await PersonModel.findOne({
            where: {
                id: p.id
            }
        })

        if(!personData)
            return [];


        let mother_id = personData.mother_id ? personData.mother_id : "";
        let father_id = personData.father_id ? personData.father_id : "";

        return PersonModel.findAll({
            where: {
                [Op.or]: [
                    {
                        mother_id
                    },
                    {
                        father_id
                    }
                ],
                id: { [Op.not] : p.id }
            }
        })
        .then((siblings: PersonModel[])=>{
            return siblings.map((sibling: PersonModel)=> this.personModelToPerson(sibling));
        })
        .catch(()=>{
            return [];
        })
    }

    async getPersonFullSiblings(p: Person): Promise<Person[]> {
        
        let personData: PersonModel | null = await PersonModel.findOne({
            where: {
                id: p.id
            }
        })

        if(!personData)
            return [];

        
        let mother_id = personData.mother_id ? personData.mother_id : "";
        let father_id = personData.father_id ? personData.father_id : "";

        return PersonModel.findAll({
            where: {
                [Op.and]: [
                    {
                        mother_id
                    },
                    {
                        father_id
                    }
                ],
                id: { [Op.not] : p.id }
            }
        })
        .then((siblings: PersonModel[])=>{
            return siblings.map((sibling: PersonModel)=> this.personModelToPerson(sibling));
        })
        .catch((error)=>{
            console.log(error);
            return [];
        })
    }

    async getPersonParents(p: Person): Promise<Person[]> {
        
        let personData: PersonModel | null = await PersonModel.findOne({
            where: {
                id: p.id
            }
        })

        if(!personData)
            return [];

        
        let fatherId = personData.father_id ? personData.father_id: "";
        let motherId = personData.mother_id ? personData.mother_id: "";

        return PersonModel.findAll({
            where: {
                [Op.or]: [
                    {
                        id: fatherId
                    },
                    {
                        id: motherId
                    }
                ]
            }
        })
        .then((parents: PersonModel[])=>{
            return parents.map((parent: PersonModel)=> this.personModelToPerson(parent));
        })
        .catch((error)=>{
            console.log(error);
            return [];
        })
    }

    async marriedTo(p:Person): Promise<MarriedTo[]>{

        let condition = { rType: 1 }; //marriage not divorce

        if(p.gender == GenderEnum.MALE)
            condition["husbandId"] = p.id;
        else 
            condition["wifeId"] = p.id;

        return MarriageRecordModel.findAll({
            where: {
                ...condition 
            },
            include: [
                {
                    model: PersonModel, 
                    as: "husband"
                },
                {
                    model: PersonModel,
                    as: "wife"
                }
            ],
            logging: true
        })
        .then((records:MarriageRecordModel[])=>{
            let response: MarriedTo[] = [];
            records.forEach((record: MarriageRecordModel) =>{
                response.push({
                    spouse: (p.gender == GenderEnum.FEMALE) ? 
                        this.personModelToPerson(record.husband): 
                        this.personModelToPerson(record.wife),
                    parent: p,
                    marriageDate: record.mDate
                })
            });
            return response;
        })
        .catch((e)=>{
            console.error(e);
            return [];
        })
    }

    async batchMarriageRecrodsBySpouseId(ids: string[]):Promise<(MarriageRecord[])[]>{
        
        return MarriageRecordModel.findAll({
            where: {
                rType: 1,
                [Op.or]: [
                    {
                        husbandId: {
                            [Op.in]: ids
                        }
                    },
                    {
                        wifeId: {
                            [Op.in]: ids
                        }
                    }
                ]
            },
            include: [
                {
                    model: PersonModel, 
                    as: "husband"
                },
                {
                    model: PersonModel,
                    as: "wife"
                }
            ],
        })
        .then((res: MarriageRecordModel[])=> {
            return ids.map((id)=> {
                return res.filter( 
                    (rec: MarriageRecordModel) => 
                        id == rec.husbandId || id == rec.wifeId 
                )
                .map( (rec: MarriageRecordModel) => 
                    this.marriageRecordModelToMarriageRecord(rec)
                )
            });
        })
    }

    async getChildren(parent1: Person, parent2: Person):Promise<Person[]>{

        if(parent1.gender == parent2.gender){
            console.log(parent1, parent2);
            throw Error("inappropiate genders for parents");
        } 
        
        let father = parent1.gender == GenderEnum.MALE ? parent1: parent2;
        let mother = parent1.gender == GenderEnum.FEMALE ? parent1: parent2;
    
        return PersonModel.findAll({
            where: {
                father_id: father.id,
                mother_id: mother.id
            }
        })
        .then((children: PersonModel[])=>{
            return children.map((child: PersonModel)=> this.personModelToPerson(child));
        })
        .catch((e)=>{ console.error(e); return []})
    }

    /**
     * 
     * @param parentIds fatherId, then MotherId
     * @returns 
     */
    async batchGetChildren(parentIds: [string, string][]): Promise<(Person[])[]> {
        
        // Extract unique parent IDs
        const uniqueFatherIds = [...new Set(parentIds.map(([fId]) => fId))].filter(fid => Boolean(fid) );
        const uniqueMotherIds = [...new Set(parentIds.map(([_, mId]) => mId))].filter(mid => Boolean(mid));

        // Single query to get all siblings
        const allSiblings = await PersonModel.findAll({
            where: {
                [Op.and]: [
                    {
                        father_id: {
                            [Op.in]: uniqueFatherIds
                        }
                    },
                    {
                        mother_id: {
                            [Op.in]: uniqueMotherIds
                        }
                    }
                ]
            }
        });

        // Map results back to original requests
        return parentIds.map(([fId, mId]) => 
            allSiblings.filter(p => 
                p.father_id === fId && 
                p.mother_id === mId
            )
        );
    }

    async getChildrenNew(father_id: string, mother_id: string){
        
        return PersonModel.findAll({
            where: {
                father_id: father_id,
                mother_id: mother_id
            }
        })
        .then((children: PersonModel[])=>{
            return children.map((child: PersonModel)=> this.personModelToPerson(child));
        })
    }
    
    async getMarriageRecord(maleNatId: string, femaleNatId: string): Promise<MarriageRecord | null>{
        
        const husband = await PersonModel.findOne({
            where: {
                ssn: maleNatId
            }
        })
        if (!husband)
          throw new MarriageReadError(
            MarriageReadErrorType.HUSBAND_NOT_FOUND,
            `can not find a person with this National Id ${maleNatId}`
          );
    
        const wife = await PersonModel.findOne({
            where: {
                ssn: femaleNatId
            }
        })
        if (!wife)
          throw new MarriageReadError(
            MarriageReadErrorType.WIFE_NOT_FOUND,
            `can not find a person with this National Id ${femaleNatId}`
          );

          
        return MarriageRecordModel.findOne({
            where: {
                husbandId: husband.id,
                wifeId: wife.id,
                rtype: 1 //marriage
            },
            include: [
                {
                    model: PersonModel,
                    as: "husband"
                },
                {
                    model: PersonModel,
                    as: "wife"
                }
            ]
        })
        .then((record: MarriageRecordModel)=>{
            
            if(!record)
            throw new MarriageReadError(
                MarriageReadErrorType.MARRIAGE_CASE_NOT_FOUND,
                `no marriage case found for these 
                people with national ids ${maleNatId} 
                & ${femaleNatId}`
            );

            return this.marriageRecordModelToMarriageRecord(record);
        })
    }

    personModelToPerson(personModel: PersonModel): Person{
        return {
            id: personModel.id,
            firstName: personModel.firstName,
            lastName: personModel.lastName,
            middleName: personModel.middleName,
            birthDate: personModel.birthDate,
            deathDate: personModel.deathDate,
            gender: personModel.gender,
            ssn: personModel.ssn,
            father_id: personModel.father_id,
            mother_id: personModel.mother_id
        }
    
    }

    marriageRecordModelToMarriageRecord(record: MarriageRecordModel): MarriageRecord{
        return {
            id: record.id,
            husband: this.personModelToPerson(record.husband),
            wife: this.personModelToPerson(record.wife),
            mDate: record.mDate
        }
    }

}