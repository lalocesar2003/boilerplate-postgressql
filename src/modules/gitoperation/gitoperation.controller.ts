import { Body, Controller, Get, Post } from '@nestjs/common';
import { GitService } from './gitoperation.service';
import { metadataDto } from './dto/metadata.dto';
import { cloneDto } from './dto/clone.dto';
@Controller('gitoperation')
export class GitoperationController {
  constructor(private gitoperation: GitService) {}

  @Post('metadata')
  async getrepostandmetada(@Body() newuser: metadataDto) {
    await this.gitoperation.createMetadata(newuser);
    return this.gitoperation.cloneAndSetupRepo(newuser.linkoriginalrepo);
  }
}
