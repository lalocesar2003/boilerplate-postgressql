import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Metadata } from './gitoperation.entity';
import { Repository } from 'typeorm';
import { createUserDto } from '../user/dto/create-user.dto';
import { metadataDto } from './dto/metadata.dto';
import { cloneDto } from './dto/clone.dto';
import * as path from 'path';
import { exec } from 'child_process';
import * as fs from 'fs';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class GitService {
  private readonly logger = new Logger(GitService.name);
  private cronJobActive = false; 
  private readonly repoTempName: string = 'temp_repo';
  private readonly gitRepoPath: string = path.join(__dirname, '../../../temp_repo');
  private readonly copyRemoteName: string = 'copy';
  private readonly originRemoteName:string='origin';
  private alreadyVisitedCommits = [];
  private pendingVisitCommits = [];
  private commitsToBeProcessedOnSetup = [];
    constructor(@InjectRepository(Metadata) private metadataRepository: Repository<Metadata>) {
    }

    async createMetadata(data:metadataDto) { 
        const userFound =await this.metadataRepository.findOne({where:{linkoriginalrepo:data.linkoriginalrepo}});
        console.log(userFound);
        
    if(userFound) {
        return new HttpException('User already exists',HttpStatus.BAD_REQUEST);
    }
 const newUser  = this.metadataRepository.create(data);
 return this.metadataRepository.save(newUser);
    }

async cloneAndSetupRepo(linkoriginalrepo:cloneDto) {

const originalRepoGit =await this.metadataRepository.findOne({where:{linkoriginalrepo:linkoriginalrepo.linkoriginalrepo}});


if (!originalRepoGit) {
  throw new HttpException('User not found', HttpStatus.NOT_FOUND);
}
if (!fs.existsSync(this.gitRepoPath)) {
 

 const gitCloneCommand = `git clone ${originalRepoGit.linkoriginalrepo} ${this.gitRepoPath}`;
    
        exec(gitCloneCommand, (error, stdout, stderr) => {
          if (error) {
            console.error(`Clone error: ${error.message}`);
            return;
          }
          this.setupGitConfig(linkoriginalrepo);
        });
      } else {
        this.logger.log('El repositorio ya ha sido clonado. Continuando con la configuración.');
        this.setupGitConfig(linkoriginalrepo);
      }
        this.cronJobActive = true;
      }

     async setupGitConfig(linkoriginalrepo:cloneDto) {
      const userFound = this.metadataRepository.findOne({where:{linkoriginalrepo:linkoriginalrepo.linkoriginalrepo}});
      const name= (await userFound).username;
      const mail = (await userFound).email;
      process.chdir(this.gitRepoPath);
      const checkRemoteCommand = `git remote get-url ${this.copyRemoteName}`;
      exec(checkRemoteCommand, async (error, stdout, stderr) => {
        let commands;
        if (error) {
          // El remoto 'copy' no existe, añadirlo
          commands = [
            `git config user.name "${name}"`,
            `git config user.email "${mail}"`,
            `git remote add ${this.copyRemoteName} ${(await (userFound)).linkcopyrepo}`
          ];
        } else {
          // El remoto 'copy' ya existe, omitir el paso de añadirlo
          commands = [
            `git config user.name "${name}"`,
            `git config user.email "${mail}"`
            // Omitir el comando de añadir el remoto ya que ya existe
          ];
        }
        this.executeCommandsSequentially(commands, () => {
          console.log("Setup finished");
          this.processInitialCommits(name,mail);
        });
      });
      }
      executeCommandsSequentially(commands, callback, index = 0) {
        if (index < commands.length) {
          exec(commands[index], (error, stdout, stderr) => {
            if (error) {
              console.error(`Command execution error: ${error.message}`);
              return;
            }
            this.executeCommandsSequentially(commands, callback, index + 1);
          });
        } else {
          callback();
        }
      }
      processInitialCommits(name,mail) {
        const logListOfCommitsInOrigin = `git log --pretty=format:"%H %ae"`;
        exec(logListOfCommitsInOrigin, (logError, logStdout, logStderr) => {
          if (logError) {
            this.logger.error(`Error fetching commits: ${logError.message}`);
            return;
          }
          const commits = logStdout.trim().split('\n').filter(commit => commit !== '');
          if (commits.length === 0) {
            this.logger.log('No pending commits on setup');
            return;
          }
          this.commitsToBeProcessedOnSetup = commits.reverse();
          if (this.commitsToBeProcessedOnSetup.length === 0) return;
          const firstCommit = this.commitsToBeProcessedOnSetup.shift();
          const [firstCommitHash, firstCommitAuthor] = firstCommit.split(' ');
          const resetCommand = `git reset --hard ${firstCommitHash}`;
        
          exec(resetCommand, (resetError, resetStdout, resetStderr) => {
            if (resetError) {
              this.logger.error(`Error resetting commit: ${resetError.message}`);
              return;
            }
            const amendCommand = `git commit --amend --author="${name} <${mail}>" -C ${firstCommitHash}`;
            exec(amendCommand, (amendError, amendStdout, amendStderr) => {
              if (amendError) {
                this.logger.error(`Error amending commit: ${amendError.message}`);
                return;
              }
              this.alreadyVisitedCommits.push(firstCommitHash);
            
            });
          });
        });
       
      }
     
     @Cron(CronExpression.EVERY_30_SECONDS)
 async handleCron(mail:string){

  if (!this.cronJobActive) {
    console.log("no hare nada");
    
    return; 
  }
  
  this.logger.debug('Running cron job');
  console.log("pending commits", this.pendingVisitCommits);
  console.log("already visited commits", this.alreadyVisitedCommits);
  await this.checkForNewCommits(mail);
}    
private async checkForNewCommits(mail:string) {
  
  const gitFetchCommand = "git fetch";
  exec(gitFetchCommand, { cwd: this.gitRepoPath }, (fetchError) => {
    if (fetchError) {
      this.logger.error(`Error fetching from remote: ${fetchError.message}`);
      return;
    }

    
    const logListOfCommitsInOrigin = `git log ${this.originRemoteName}/main --pretty=format:"%H"`;
    exec(logListOfCommitsInOrigin, { cwd: this.gitRepoPath }, (logError, logStdout) => {
      if (logError) {
        this.logger.error(`Error fetching commits: ${logError.message}`);
        return;
      }

      const listOfCommitsInOrigin = logStdout.trim().split('\n').filter(commit => commit !== '');
      if (listOfCommitsInOrigin.length === 0) {
        this.logger.log('No new commits to process');
        return;
      }

      
      const commitsToVisit = listOfCommitsInOrigin.filter(commit => !this.alreadyVisitedCommits.includes(commit) && !this.pendingVisitCommits.includes(commit));
      this.pendingVisitCommits = [...this.pendingVisitCommits, ...commitsToVisit.reverse()];

      if (this.pendingVisitCommits.length === 0) {
        this.logger.log("nothing to visit");
        return;
      }

      
      const commitToVisit = this.pendingVisitCommits.shift();
      this.logger.log(`Visiting commit ${commitToVisit}`);
      this.processCommit(commitToVisit,mail);
    });
  });
}
private processCommit(commitHash: string,mail:string) {
  
  const cherryPickLastCommit = `git cherry-pick ${commitHash}`;
  exec(cherryPickLastCommit, { cwd: this.gitRepoPath }, (cherryPickError, cherryPickStdout) => {
    if (cherryPickError) {
      this.logger.error(`Error cherry-picking commit ${commitHash}: ${cherryPickError.message}`);
      return;
    }

    const logLastCommitWithAuthor = `git log -n 1 --format="%H %ae"`;
    exec(logLastCommitWithAuthor, { cwd: this.gitRepoPath }, (logError, logStdout) => {
      if (logError) {
        this.logger.error(`Error logging last commit: ${logError.message}`);
        return;
      }

      const [lastCommitHash, lastCommitAuthor] = logStdout.trim().split(' ');
      if (lastCommitAuthor !== mail) {
       
        const gitAmendCommand = `git commit --amend --author="Author Name <AuthorEmail>" -C ${lastCommitHash}`;
        exec(gitAmendCommand, { cwd: this.gitRepoPath }, (amendError, amendStdout) => {
          if (amendError) {
            this.logger.error(`Error amending commit: ${amendError.message}`);
            return;
          }
          const gitPushCommand = `git push ${this.copyRemoteName} main`;
          exec(gitPushCommand, { cwd: this.gitRepoPath }, (pushError, pushStdout) => {
            if (pushError) {
              this.logger.error(`Error pushing to copy repo: ${pushError.message}`);
              return;
            }
            this.logger.log(`Commit ${lastCommitHash} amended and pushed`);
          });
        });
      } else {
        this.logger.log(`Commit ${lastCommitHash} by ${lastCommitAuthor} matches the author email. Skipping amend.`);
      }
    });

  
    this.alreadyVisitedCommits.push(commitHash);
  });
}


}

