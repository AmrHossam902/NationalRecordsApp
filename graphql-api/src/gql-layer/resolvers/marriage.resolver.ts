import { Resolver, Query, Args, ResolveField, Parent } from '@nestjs/graphql';
import { PersonService } from '../person-service.interface';
import { MarriageRecord } from '../models/marriage-record.model';
import { Inject } from '@nestjs/common';

@Resolver(() => MarriageRecord)
export class MarriageResolver {
  constructor(@Inject('PersonService') private readonly personService: PersonService) {}

  @Query(() => MarriageRecord)
  async marriage(
    @Args('maleNatId', { type: () => String }) maleNatId: string,
    @Args('femaleNatId', { type: () => String }) femaleNatId: string,
  ) {
    return this.personService.getMarriageRecord(maleNatId, femaleNatId);
  }

  @ResolveField()
  async children(@Parent() marriageRecord: MarriageRecord) {
    return this.personService.getChildren(marriageRecord.husband, marriageRecord.wife);
  }
}