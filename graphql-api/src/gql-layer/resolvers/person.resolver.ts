import { Resolver, Query, Args, Mutation, Int, ResolveField, Parent, Context } from '@nestjs/graphql';
import { PersonService } from '../person-service.interface';
import { Person } from '../models/person.model';
import { PeoplePage } from '../models/people-page.model';
import { FilterInput } from '../inputs/filter.input';
import { Inject, UseGuards } from '@nestjs/common';
import { MarriedTo } from '../models/marriedTo.model';
import { CreatePersonInput } from '../inputs/create-person.input';
import { JwtAuthGuard } from '../auth/auth.guard';
import * as DataLoader from 'dataloader';
import { PersonServiceSequelize } from 'src/sequelize-layer/services/person.service';
import { GQLContext } from '../context/gqlContext';
import { MarriageRecord } from '../models/marriage-record.model';
import { GenderEnum } from '../scalars/gender.scalar';

@UseGuards(JwtAuthGuard)
@Resolver(() => Person)
export class PersonResolver {
  constructor(@Inject('PersonService') private readonly personService: PersonServiceSequelize) {}

  @Query(() => PeoplePage, {nullable: false})
  async people(
    @Args('after', { nullable: true }) after: string,
    @Args('before', { nullable: true }) before: string,
    @Args('sort', { type: () => [[String]], nullable: true }) sort: [string, string][],
    @Args('limit', { type: () => Int, nullable: true  }) limit: number,    
    @Args('filter', { type: () => FilterInput, nullable: true  }) filter: FilterInput,
    @Args('search', { nullable: true }) search: string,
  ) {
    return this.personService.getAllPeople(after, before, sort, limit, filter, search);
  }

  @Query(() => Person)
  async someone(@Args('ssn', { type: () => String }) ssn: string) {

    return this.personService.getPersonBySSN(ssn);
  }

  @ResolveField()
  async siblings (@Parent() person:Person, @Context() ctx: GQLContext) {

    const childrenLoader = ctx.childrenLoader as DataLoader<[string, string], Person[]>;

    if(!person.mother_id || !person.father_id)
      throw new Error('PARENTS_MISSING');
    
    let children = await childrenLoader.load([person.father_id, person.mother_id]); 
    
    let personIndex = children.findIndex((child)=> child.id == person.id);
    
    children.splice(personIndex, 1);
    return children;
  }

  @ResolveField()
  async parents (@Parent() person: Person, @Context() ctx: GQLContext) {

    const personLoader = ctx.personLoader as DataLoader<string,Person>;

    if(!person.father_id || !person.mother_id)
      throw new Error("PARENTS_MISSING");

    return personLoader.loadMany([person.father_id, person.mother_id]);

  }

  @ResolveField()
  async marriedTo(@Parent() person: Person, @Context() ctx: GQLContext) {
    
    let mRecords: MarriageRecord[] = await ctx.marriageLoader.load(person.id!);

    if(person.gender == GenderEnum.MALE)
      return mRecords.map((mRecord) => {
        return {
          parent: person,
          spouse: mRecord.wife,
          marriageDate: mRecord.mDate
        }    
      });
    else {
      return mRecords.map((mRecord) => {
        return {
          parent: person,
          spouse: mRecord.husband,
          marriageDate: mRecord.mDate
        }    
      });
    }
  }
  
  @Mutation(() => Person)
  async addNewPerson(@Args('person') person: CreatePersonInput) {
    return this.personService.createNewPerson(person);
  } 
}