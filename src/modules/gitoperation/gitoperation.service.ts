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

  private readonly repoTempName: string = 'temp_repo';
  private readonly gitRepoPath: string = path.join(__dirname, this.repoTempName);
  private readonly copyRemoteName: string = 'copy';
  private readonly originRemoteName:string='origin';
  private alreadyVisitedCommits = [];
  private pendingVisitCommits = [];
  private commitsToBeProcessedOnSetup = [];
    constructor(@InjectRepository(Metadata) private metadataRepository: Repository<Metadata>) {
    }

    async createMetadata(data:metadataDto) { 
        const userFound =await this.metadataRepository.findOne({where:{email:data.mail}});
    if(!userFound) {
        return new HttpException('User already exists',HttpStatus.BAD_REQUEST);
    }
 const newUser  = this.metadataRepository.create(data);
 return this.metadataRepository.save(newUser);
    }
// git clone the repo into a temp folder in same path as this file
async cloneAndSetupRepo(username:cloneDto) {

const originalRepoGit =await this.metadataRepository.findOne({where:{username:username.username}});


if (!originalRepoGit) {
  throw new HttpException('User not found', HttpStatus.NOT_FOUND);
}

 const gitCloneCommand = `git clone ${originalRepoGit.linkoriginalrepo} ${this.gitRepoPath}`;
    
        exec(gitCloneCommand, (error, stdout, stderr) => {
          if (error) {
            console.error(`Clone error: ${error.message}`);
            return;
          }
          this.setupGitConfig(username);
        });
      }

     async setupGitConfig(username:cloneDto) {
      const userFound = this.metadataRepository.findOne({where:{username:username.username}});
      const name= (await userFound).username;
      const mail = (await userFound).email;
        process.chdir(this.gitRepoPath);
        const commands = [
          `git config user.name "${(name)}"`,
          `git config user.email "${(mail)}"`,
          `git remote add ${this.copyRemoteName} ${(await userFound).linkcopyrepo}`
        ];
    
        this.executeCommandsSequentially(commands, () => {
          console.log("Setup finished");
          this.processInitialCommits(name,mail);
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
     
//      @Cron(CronExpression.EVERY_30_SECONDS)
// async handleCron(mail:string){
//   this.logger.debug('Running cron job');
//   console.log("pending commits", this.pendingVisitCommits);
//   console.log("already visited commits", this.alreadyVisitedCommits);
//   await this.checkForNewCommits(mail);
// }    
// private async checkForNewCommits(mail:string) {
//   // Primero, actualiza el repositorio local con los cambios del remoto
//   const gitFetchCommand = "git fetch";
//   exec(gitFetchCommand, { cwd: this.gitRepoPath }, (fetchError) => {
//     if (fetchError) {
//       this.logger.error(`Error fetching from remote: ${fetchError.message}`);
//       return;
//     }

//     // Luego, lista los commits del repositorio remoto actualizado
//     const logListOfCommitsInOrigin = `git log ${this.originRemoteName}/main --pretty=format:"%H"`;
//     exec(logListOfCommitsInOrigin, { cwd: this.gitRepoPath }, (logError, logStdout) => {
//       if (logError) {
//         this.logger.error(`Error fetching commits: ${logError.message}`);
//         return;
//       }

//       const listOfCommitsInOrigin = logStdout.trim().split('\n').filter(commit => commit !== '');
//       if (listOfCommitsInOrigin.length === 0) {
//         this.logger.log('No new commits to process');
//         return;
//       }

//       // Filtra los commits que aún no han sido visitados o están pendientes
//       const commitsToVisit = listOfCommitsInOrigin.filter(commit => !this.alreadyVisitedCommits.includes(commit) && !this.pendingVisitCommits.includes(commit));
//       this.pendingVisitCommits = [...this.pendingVisitCommits, ...commitsToVisit.reverse()];

//       if (this.pendingVisitCommits.length === 0) {
//         this.logger.log("nothing to visit");
//         return;
//       }

//       // Procesa el primer commit pendiente
//       const commitToVisit = this.pendingVisitCommits.shift();
//       this.logger.log(`Visiting commit ${commitToVisit}`);
//       this.processCommit(commitToVisit,mail);
//     });
//   });
// }
// private processCommit(commitHash: string,mail:string) {
//   // Lógica para procesar el commit específico, como cherry-pick, amend, etc.
//   const cherryPickLastCommit = `git cherry-pick ${commitHash}`;
//   exec(cherryPickLastCommit, { cwd: this.gitRepoPath }, (cherryPickError, cherryPickStdout) => {
//     if (cherryPickError) {
//       this.logger.error(`Error cherry-picking commit ${commitHash}: ${cherryPickError.message}`);
//       return;
//     }

//     // Supongamos que queremos revisar el autor del último commit procesado
//     const logLastCommitWithAuthor = `git log -n 1 --format="%H %ae"`;
//     exec(logLastCommitWithAuthor, { cwd: this.gitRepoPath }, (logError, logStdout) => {
//       if (logError) {
//         this.logger.error(`Error logging last commit: ${logError.message}`);
//         return;
//       }

//       const [lastCommitHash, lastCommitAuthor] = logStdout.trim().split(' ');
//       if (lastCommitAuthor !== mail) {
//         // Si el autor del commit no coincide, modifícalo y luego empuja el cambio
//         const gitAmendCommand = `git commit --amend --author="Author Name <AuthorEmail>" -C ${lastCommitHash}`;
//         exec(gitAmendCommand, { cwd: this.gitRepoPath }, (amendError, amendStdout) => {
//           if (amendError) {
//             this.logger.error(`Error amending commit: ${amendError.message}`);
//             return;
//           }
//           // Finalmente, empuja el commit modificado
//           const gitPushCommand = `git push ${this.copyRemoteName} main`;
//           exec(gitPushCommand, { cwd: this.gitRepoPath }, (pushError, pushStdout) => {
//             if (pushError) {
//               this.logger.error(`Error pushing to copy repo: ${pushError.message}`);
//               return;
//             }
//             this.logger.log(`Commit ${lastCommitHash} amended and pushed`);
//           });
//         });
//       } else {
//         this.logger.log(`Commit ${lastCommitHash} by ${lastCommitAuthor} matches the author email. Skipping amend.`);
//       }
//     });

//     // Actualiza el registro de commits ya visitados
//     this.alreadyVisitedCommits.push(commitHash);
//   });
// }


}

