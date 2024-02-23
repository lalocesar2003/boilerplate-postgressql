import { Module } from '@nestjs/common';
import { GitService } from './gitoperation.service';
import { GitoperationController } from './gitoperation.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import {  Metadata } from './gitoperation.entity';
import { ScheduleModule } from '@nestjs/schedule';
import { CommitEntity } from './commit.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Metadata,CommitEntity]),  ScheduleModule.forRoot(),],
  controllers: [GitoperationController],
  providers: [GitService],
  exports: [GitService],
})
export class GitOperationModule {}
