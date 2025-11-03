import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { PersonServiceSequelize } from './sequelize-layer/services/person.service';
import { PersonService } from './gql-layer/person-service.interface';
import { PersonResolver } from './gql-layer/resolvers/person.resolver';
import { MarriageResolver } from './gql-layer/resolvers/marriage.resolver';
import { SequelizeModule } from '@nestjs/sequelize';
import { MarriageRecordModel } from './sequelize-layer/models/MarriageRecord';
import { PersonModel } from './sequelize-layer/models/Person';
import { MarriedToResolver } from './gql-layer/resolvers/marriedTo.resolver';
import { DateScalar } from './gql-layer/scalars/date.scalar';
import { Gender} from './gql-layer/scalars/gender.scalar';
import { DbProvider } from './sequelize-layer/db-provider';
import { GeneratorService } from './sequelize-layer/services/generator.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthServiceSequelize } from './sequelize-layer/services/auth.service';
import { AuthResolver } from './gql-layer/resolvers/auth.resolver';
import { JwtAuthGuard } from './gql-layer/auth/auth.guard';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './gql-layer/auth/jwt-strategy';
import * as DataLoader from 'dataloader';
import { Person } from './gql-layer/models/person.model';
import { ModuleRef } from '@nestjs/core';
import { GQLContext } from './gql-layer/context/gqlContext';


@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [ModuleRef],
      useFactory: async (moduleRef: ModuleRef) => ({
        autoSchemaFile: join(process.cwd(), 'dist/schema.gql'),
        playground: false,
        plugins: [ApolloServerPluginLandingPageLocalDefault()],
        resolvers: {
          Gender: Gender
        },
        context: ({ req }) => {
          const personService = moduleRef.get('PersonService', { strict: false });
          return new GQLContext(personService, req);  
        }
      })
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: '3m'
      }
    })
  ],
  providers: [
    {
      provide: 'PersonService',
      useClass: PersonServiceSequelize
    },
    {
      provide: 'AuthService',
      useClass: AuthServiceSequelize
    },
    GeneratorService,
    DbProvider,
    AuthResolver,
    PersonResolver, 
    MarriageResolver,
    MarriedToResolver,
    DateScalar,
    JwtAuthGuard,
    JwtStrategy,
    AppService
  ],

  controllers: [
    AppController
  ],
})
export class AppModule {}
