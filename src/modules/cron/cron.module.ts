import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { CronController } from './cron.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Metadata } from '../gitoperation/gitoperation.entity';
import { CommitEntity } from '../gitoperation/commit.entity';
import { GitService } from '../gitoperation/gitoperation.service';

@Module({
  imports:[TypeOrmModule.forFeature([Metadata, CommitEntity]),
   ],
  providers: [CronService],
  controllers: [CronController],
 
})
export class CronModule {}
