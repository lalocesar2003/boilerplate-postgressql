import { Module } from '@nestjs/common';
import { SshService } from './ssh.service';
import { SshController } from './ssh.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { sshdata } from './ssh.entity';

@Module({
  imports: [TypeOrmModule.forFeature([sshdata])],
  providers: [SshService],
  controllers: [SshController]
})
export class SshModule {}
