import { Module } from '@nestjs/common';
import { GitService } from './gitoperation.service';
import { GitoperationController } from './gitoperation.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import {  Metadata } from './gitoperation.entity';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [TypeOrmModule.forFeature([Metadata]),  ScheduleModule.forRoot(),],
  controllers: [GitoperationController],
  providers: [GitService],
  exports: [GitService],
})
export class GitOperationModule {}
