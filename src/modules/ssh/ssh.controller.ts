import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { SshService } from './ssh.service';
import { sshDto } from './dto/ssh.dto';
import { configDto } from './dto/config.dto';


@Controller('ssh')
export class SshController {

    constructor(private sshService:SshService){}
   
   
    @Post('data')
    getdata(@Body() data:sshDto){
        return this.sshService.createdata(data);
    }
    @Post('/generateKey')
    async generateKey(@Body() username: configDto) {
      try {
        await this.sshService.generateSSHKey(username);
        return { message: 'SSH Key generated successfully' };
      } catch (error) {
        throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
}