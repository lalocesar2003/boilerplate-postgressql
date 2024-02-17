import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../modules/user/user.entity';
import {ConfigModule,ConfigService} from '@nestjs/config';
import { Metadata } from 'src/modules/gitoperation/gitoperation.entity';
import { sshdata } from 'src/modules/ssh/ssh.entity';
@Module({ imports: [
    TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
      inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
            return {
            type: 'mysql',
            host: configService.get('DB_HOST'),
            port: configService.get('DB_PORT'),
          
            username: configService.get('DB_USERNAME'),
            password: configService.get('DB_PASSWORD'),
            database: configService.get('DB_NAME'),
            entities: [User,Metadata,sshdata],
            synchronize: true,
            }
        },
 
  })]})
export class DatabaseModule {
   
}
