import { PeoplePage } from "src/gql-layer/interfaces/PeoplePage.interface";
import { MarriageRecord } from "src/gql-layer/models/marriage-record.model";
import { MarriedTo } from "src/gql-layer/models/marriedTo.model";
import { Person } from "src/gql-layer/models/person.model";
import { CreatePersonInput } from "./inputs/create-person.input";

export interface PersonService {
    
    createNewPerson(personData: CreatePersonInput): Promise<Person>;
    
    getPersonById(id: string): Promise<Person>;
    
    getPersonBySSN(ssn: String): Promise<Person>;

    getAllPeople(
        after: string, //json
        before: string, //json
        sort:[string, string][],
        limit: number,
        filters: Record<string, any>,
        search: string
    ): Promise<PeoplePage>;

    validateCursorParams( cursor: string, sort: [string, string][]): Record<string, any>;
    
    validateSortArray(sort: [string, string][]) : [string, string][];
    
    getPersonSiblings(p: Person): Promise<Person[]>;
    
    getPersonFullSiblings(p: Person): Promise<Person[]>;
    
    getPersonParents(p: Person): Promise<Person[]>;
    
    marriedTo(p:Person): Promise<MarriedTo[]>;
    
    getChildren(parent1: Person, parent2: Person):Promise<Person[]>;
        
    getMarriageRecord(maleNatId: string, femaleNatId: string): Promise<MarriageRecord | null>;
}