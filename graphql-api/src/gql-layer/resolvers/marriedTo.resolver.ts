import { PersonService } from '../person-service.interface';
import { MarriageRecord } from '../models/marriage-record.model';
import { Inject } from '@nestjs/common';
import { MarriedTo } from '../models/marriedTo.model';
import { Context, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Person } from '../models/person.model';
import { GQLContext } from '../context/gqlContext';
import DataLoader from 'dataloader';
import { GenderEnum } from '../scalars/gender.scalar';

@Resolver(() => MarriedTo)
export class MarriedToResolver {
    constructor(@Inject('PersonService') private readonly personService: PersonService) {}

    @ResolveField()
    children(@Parent() marriedTo: MarriedTo, @Context() ctx: GQLContext): Promise<Person[]> {
        
        let childrenLoader: DataLoader<[string, string], Person[]> 
            = ctx.childrenLoader;

        let father = marriedTo.parent.gender == GenderEnum.MALE ?
            marriedTo.parent : marriedTo.spouse;

        let mother = marriedTo.parent.gender == GenderEnum.FEMALE ?
            marriedTo.parent : marriedTo.spouse;

        return childrenLoader.load([father.id!, mother.id!]);
    }



}

