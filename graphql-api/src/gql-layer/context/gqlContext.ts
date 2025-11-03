import * as DataLoader from "dataloader";
import { Person } from "../models/person.model";
import { PersonServiceSequelize } from "src/sequelize-layer/services/person.service";
import { Request } from "express";
import { MarriageRecord } from "../models/marriage-record.model";

export class GQLContext {

    personLoader: DataLoader<string, Person|null>
    childrenLoader: DataLoader<[string, string], Person[]>
    marriageLoader: DataLoader<string, MarriageRecord[]>

    constructor(
        public personService: PersonServiceSequelize,
        req: Request
    ){
        console.log("new GQL context created");
        this.createLoaders();
    }


    createLoaders(){
        
        this.personLoader = new DataLoader<string, Person| null>(
            async (ids: string[]) => { 
                console.log("calling batch person with ", ids);
                let people = await this.personService.batchGetPersonById(ids);
                console.log("person result", people);
                return people;
            }
        );

        this.childrenLoader = new DataLoader<[string, string], Person[]>(
            async (parentIds: [string, string][]) => { 

                console.log("calling batch children with keys ", parentIds);

                let children = await this.personService.batchGetChildren(parentIds);
                
                console.log("children result ", children);

                // store children in person loader
                [...new Set(children.flat())]
                .forEach(child => this.personLoader.prime(child.id!, child));
                
                return children;
            }
        );

        this.marriageLoader = new DataLoader<string, MarriageRecord[]>(
            async (spouseIds: string[]) => {

                console.log("calling batch marriages with ", spouseIds);

                let records = await this.personService.batchMarriageRecrodsBySpouseId(spouseIds);

                console.log("marriage result ", records);

                records.flat().forEach((rec)=> {
                    this.personLoader.prime(rec.husband.id!, rec.husband);
                    this.personLoader.prime(rec.wife.id!, rec.wife);
                })

                return records;
            }
        );
    }


}