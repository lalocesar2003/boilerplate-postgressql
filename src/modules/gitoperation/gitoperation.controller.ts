import { Body, Controller, Get, Post } from '@nestjs/common';
import { GitService } from './gitoperation.service';
import { metadataDto } from './dto/metadata.dto';

@Controller('gitoperation')
export class GitoperationController {
  constructor(private gitoperation: GitService) {}

  @Post('cloneandsetup')
  async getrepostandmetada(@Body() newuser: metadataDto) {
    await this.gitoperation.createMetadata(newuser);
    return this.gitoperation.cloneAndSetupRepo(newuser.linkoriginalrepo);
  }
  @Post('/pause-cron')
  pauseCronJob() {
    this.gitoperation.setCronJobActive(false);
    return { message: 'Cron job has been paused.' };
  }

  @Post('/resume-cron')
  resumeCronJob() {
    this.gitoperation.setCronJobActive(true);
    return { message: 'Cron job has been resumed.' };
  }
}
