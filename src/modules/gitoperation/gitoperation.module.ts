import { Module } from '@nestjs/common';
import { GitService } from './gitoperation.service';

@Module({
  providers: [GitService]
})
export class GitOperationModule {}
