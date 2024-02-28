import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { SshService } from './ssh.service';
import { sshDto } from './dto/ssh.dto';


@Controller('ssh')
export class SshController {
  constructor(private sshService: SshService) {}

  @Post('generatesshkey')
  async getdata(@Body() data: sshDto) {
    const githubusername = data;
    await this.sshService.createdata(data);
    try {
      const data = await this.sshService.generateSSHKey(
        githubusername.githubUsername,
      );
      return {
        message: 'SSH Key generated successfully  ' + `publickey:${data}`,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  
 
}
