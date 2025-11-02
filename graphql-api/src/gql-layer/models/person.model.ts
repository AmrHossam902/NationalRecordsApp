import { ObjectType, Field, ID } from '@nestjs/graphql';
import { MarriedTo } from './marriedTo.model';
import { Gender, GenderEnum } from '../scalars/gender.scalar';

@ObjectType()
export class Person {
  @Field(() => ID, { nullable: true })
  id?: string;

  @Field()
  firstName: string;

  @Field()
  lastName: string;

  @Field()
  middleName: string;

  @Field()
  birthDate: Date;
 
  @Field({ nullable: true })
  deathDate?: Date;

  @Field(type => Gender)
  gender: GenderEnum;

  @Field()
  ssn: string;

  @Field(() => [Person], { nullable: true })
  siblings?: Person[];

  mother_id?: string;
  father_id?: string;

  @Field(() => [Person], { nullable: true })
  parents?: Person[];

  @Field(() => [MarriedTo], { nullable: true })
  marriedTo?: MarriedTo[];
}