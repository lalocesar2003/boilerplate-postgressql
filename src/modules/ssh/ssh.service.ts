import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { sshDto } from './dto/ssh.dto';
import { sshdata } from './ssh.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { configDto } from './dto/config.dto';

@Injectable()
export class SshService {
    private readonly logger = new Logger(SshService.name);
    private readonly sshDirPath = 'temporary_ssh';
    private readonly githubUsername = 'lalocesar2003';
    private readonly githubEmail = 'ceed1000@gmail.com';
    private get gitKeysPath(): string {
      return path.join(__dirname, '../../../temporary_ssh');
    }
    private get privateKeyPath(): string {
      return `${this.gitKeysPath}/id_rsa_${this.githubUsername}`;
    }
    private get publicKeyPath(): string {
      return `${this.privateKeyPath}.pub`;
    }
  
    constructor(@InjectRepository(sshdata) private sshrepository:Repository<sshdata>) { }
  
    async createdata(data:sshDto) { 
        const userFound =await this.sshrepository.findOne({where:{githubemail:data.githubemail}});
    if(userFound) {
        return new HttpException('User already exists',HttpStatus.BAD_REQUEST);
    }
 const newUser  = this.sshrepository.create(data);

 return this.sshrepository.save(newUser);

    }

    async getConfig(username:configDto) {
     
      const config = await this.sshrepository.findOne({where: {githubusername: username.githubusername}});
      if (!config) {
        throw new HttpException('SSH configuration not found', HttpStatus.NOT_FOUND);
      }
      return config;

    }

    async privateKeyPathwithdatabase(username:configDto) {
      const { githubusername } = await this.getConfig(username);
      // si funciona no olvides modificar la /
      return `${this.gitKeysPath}\\\\id_rsa_${githubusername}`;
  }

 async publicKeyPathwithdatabase(username:configDto) {
    const privateKeyPath = await this.privateKeyPathwithdatabase(username);
    return `${privateKeyPath}.pub`;
}

    async generateSSHKey(username:configDto) {
      const {githubemail}=await this.getConfig(username);
      const privateKeyPath = await this.privateKeyPathwithdatabase(username);
      console.log(privateKeyPath);
      
      if (!fs.existsSync(this.sshDirPath)) {
        fs.mkdirSync(this.sshDirPath, { recursive: true });
      }
  
      if (fs.existsSync(privateKeyPath)) {
        this.logger.log(`Private key file already exists: ${privateKeyPath}`);
      } else {
        const sshKeygenCommand = `ssh-keygen -t rsa -C "${githubemail}" -f "${privateKeyPath}" -N ""`;
        exec(sshKeygenCommand, (error, stdout, stderr) => {
          if (error) {
            this.logger.error(`Error generating SSH key: ${error.message}`);
            return;
          }
          if (stderr) {
            this.logger.error(`SSH keygen stderr: ${stderr}`);
            return;
          }
          this.logger.log(`SSH key generated successfully: ${stdout}`);
          // this.addKeyToSshAgent(username);
          // this.updateSshConfig(username);
          // this.logPublicKey(username);
        });
      }
    }
  
    private async addKeyToSshAgent(username:configDto) {
      const privateKeyPath = await this.privateKeyPathwithdatabase(username);
      const sshAddCommand = `ssh-add ${privateKeyPath}`;
      exec(sshAddCommand, (addError, addStdout, addStderr) => {
        if (addError) {
          this.logger.error(`Error adding SSH key to agent: ${addError.message}`);
          return;
        }
        this.logger.log('SSH key pair added to SSH agent.');
      });
    }
  
    private async updateSshConfig(username:configDto) {
      const {githubemail,githubusername}=await this.getConfig(username);
      const privateKeyPath = await this.privateKeyPathwithdatabase(username);
      const sshConfigPath = path.join(process.env.HOME || '', '.ssh', 'config');
      const configContent = `#${githubusername} account\nHost github.com-${githubusername}\n  HostName github.com\n  User git\n  IdentityFile ${privateKeyPath}\n`;
      fs.readFile(sshConfigPath, "utf8", (readError, data) => {
        if (readError && readError.code !== "ENOENT") {
          this.logger.error(`Error reading SSH config file: ${readError.message}`);
          return;
        }
  
        const configToAdd = data ? `${data}\n${configContent}` : configContent;
        fs.appendFile(sshConfigPath, configToAdd, (appendError) => {
          if (appendError) {
            this.logger.error(`Error appending SSH config file: ${appendError.message}`);
            return;
          }
          this.logger.log('SSH config file updated.');
        });
      });
    }
  
    private async logPublicKey(username:configDto) {
    const publicKeyPath = await this.publicKeyPathwithdatabase(username);
      fs.readFile(publicKeyPath, "utf8", (readError, data) => {
        if (readError) {
          this.logger.error(`Error reading public key file: ${readError.message}`);
          return;
        }
        this.logger.log(`Public key content:\n${data}`);
      });
      console.log('scrip is running');
      
    }

  }