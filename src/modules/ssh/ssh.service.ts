import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { sshDto } from './dto/ssh.dto';
import { sshdata } from './ssh.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { configDto } from './dto/config.dto';
import { promises as fsPromises } from 'fs';

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

  constructor(
    @InjectRepository(sshdata) private sshrepository: Repository<sshdata>,
  ) {}

  async createdata(data: sshDto) {
    const userFound = await this.sshrepository.findOne({
      where: { githubemail: data.githubemail },
    });
    if (userFound) {
      return new HttpException('User already exists', HttpStatus.BAD_REQUEST);
    }
    const newUser = this.sshrepository.create(data);

    return this.sshrepository.save(newUser);
  }

  async getConfig(username: string) {
    const config = await this.sshrepository.findOne({
      where: { githubUsername: username },
    });
    if (!config) {
      throw new HttpException(
        'SSH configuration not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return config;
  }

  async privateKeyPathwithdatabase(username: string) {
    const { githubUsername } = await this.getConfig(username);
    console.log('me ejecuto para indicar la ruta ');

    console.log(this.gitKeysPath);

    return `${this.gitKeysPath}/id_rsa_${githubUsername}`;
  }

  async publicKeyPathwithdatabase(username: string) {
    const privateKeyPath = await this.privateKeyPathwithdatabase(username);
    return `${privateKeyPath}.pub`;
  }

  async generateSSHKey(username: string): Promise<string> {
    const { githubemail } = await this.getConfig(username);
    const privateKeyPath = await this.privateKeyPathwithdatabase(username);
    console.log(privateKeyPath);

    if (!fs.existsSync(this.sshDirPath)) {
      fs.mkdirSync(this.sshDirPath, { recursive: true });
    }

    if (fs.existsSync(privateKeyPath)) {
      this.logger.log(`Private key file already exists: ${privateKeyPath}`);
      return this.logPublicKey(username);
    } else {
      return new Promise((resolve, reject) => {
        const sshKeygenCommand = `ssh-keygen -t rsa -C "${githubemail}" -f "${privateKeyPath}" -N ""`;
        exec(sshKeygenCommand, async (error, stdout, stderr) => {
          if (error) {
            this.logger.error(`Error generating SSH key: ${error.message}`);
            reject(error);
            return;
          }
          if (stderr) {
            this.logger.error(`SSH keygen stderr: ${stderr}`);
            reject(new Error(stderr));
            return;
          }
          this.logger.log(`SSH key generated successfully: ${stdout}`);
         
          try {
             await this.addKeyToSshAgent(username);
            await this.updateSshConfig(username);
            const data = await this.logPublicKey(username);
            resolve(data); 
          } catch (e) {
            reject(e);
          }
        });
      });
    }
  }

  private async addKeyToSshAgent(username: string) {
    const privateKeyPath = await this.privateKeyPathwithdatabase(username);
    const sshAddCommand = `ssh-add ${privateKeyPath}`;

    exec(sshAddCommand, (addError, addStdout, addStderr) => {
      console.log(addError);
      console.log(addStdout);
      console.log(addStderr);
      if (addError) {
        this.logger.error(`Error adding SSH key to agent: ${addError.message}`);
        return;
      }
      this.logger.log('SSH key pair added to SSH agent.');
    });
  }

  private async updateSshConfig(username: string) {
    const { githubemail, githubUsername } = await this.getConfig(username);
    const privateKeyPath = await this.privateKeyPathwithdatabase(username);
    const sshConfigPath = path.join(process.env.HOME || '', '.ssh', 'config');
    const configContent = `#${githubUsername} account\nHost github.com-${githubUsername}\n  HostName github.com\n  User git\n  IdentityFile ${privateKeyPath}\n`;
    fs.readFile(sshConfigPath, 'utf8', (readError, data) => {
      if (readError && readError.code !== 'ENOENT') {
        this.logger.error(
          `Error reading SSH config file: ${readError.message}`,
        );
        return;
      }

      const configToAdd = data ? `${data}\n${configContent}` : configContent;
      fs.appendFile(sshConfigPath, configToAdd, (appendError) => {
        if (appendError) {
          this.logger.error(
            `Error appending SSH config file: ${appendError.message}`,
          );
          return;
        }
        this.logger.log('SSH config file updated.');
      });
    });
  }

  private async logPublicKey(username: string) {
    try {
      const publicKeyPath = await this.publicKeyPathwithdatabase(username);
      const data = await fsPromises.readFile(publicKeyPath, 'utf8');
      this.logger.log(`Public key content:\n${data}`);
      console.log('script is running');
      return data;
    } catch (error) {
      this.logger.error(`Error reading public key file: ${error.message}`);
    }
  }
}
