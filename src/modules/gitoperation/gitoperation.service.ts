import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Metadata } from './gitoperation.entity';
import { Repository } from 'typeorm';
import { createUserDto } from '../user/dto/create-user.dto';
import { metadataDto } from './dto/metadata.dto';

import * as path from 'path';
import { exec } from 'child_process';
import * as fs from 'fs';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { CommitEntity } from './commit.entity';
import { log } from 'console';
import { CronJob } from 'cron';

@Injectable()
export class GitService implements OnModuleInit {
  private readonly logger = new Logger(GitService.name);
  private cronJobActive = false;
  private readonly repoTempName: string = 'temp_repo';
  private readonly gitRepoPath: string = path.join(
    __dirname,
    '../../../temp_repo',
  );
  private readonly copyRemoteName: string = 'copy';
  private readonly originRemoteName: string = 'origin';
  private alreadyVisitedCommits = [];
  private pendingVisitCommits = [];
  private commitsToBeProcessedOnSetup = [];
  private cronJobArguments: string = null;
  public setCronJobActive(isActive: boolean): void {
    const job = this.schedulerRegistry.getCronJob('gitServiceCronJob'); // Asume que este es el nombre de tu cron job
  
    if (isActive) {
      job.start();
      this.logger.log('Cron job started');
    } else {
      job.stop();
      this.logger.log('Cron job stopped');
    }
  }
  

  constructor(
    @InjectRepository(Metadata)
    private metadataRepository: Repository<Metadata>,
    @InjectRepository(CommitEntity)
    private commitRepository: Repository<CommitEntity>,
    private schedulerRegistry: SchedulerRegistry,
  ) {}
  async onModuleInit() {
    await this.loadCommits();
    await this.checkoutLastProcessedCommit();
    const gitServiceCronJob = new CronJob(CronExpression.EVERY_30_SECONDS, async () => {
      await this.handleCron();
    });
  
    // Registrar el CronJob en el SchedulerRegistry
    this.schedulerRegistry.addCronJob('gitServiceCronJob', gitServiceCronJob);
  
    // Opcionalmente, iniciar el cron job ahora o basado en alguna condición
    gitServiceCronJob.start();
  }

  async createMetadata(data: metadataDto) {
    const userFound = await this.metadataRepository.findOne({
      where: { linkoriginalrepo: data.linkoriginalrepo },
    });

    if (userFound) {
      return new HttpException('User already exists', HttpStatus.BAD_REQUEST);
    }
    const newUser = this.metadataRepository.create(data);

    return this.metadataRepository.save(newUser);
  }

  async cloneAndSetupRepo(linkoriginalrepo: string) {
    const originalRepoGit = await this.metadataRepository.findOne({
      where: { linkoriginalrepo: linkoriginalrepo },
    });

    if (!originalRepoGit) {
      throw new HttpException('User not found ', HttpStatus.NOT_FOUND);
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
      this.logger.log(
        'El repositorio ya ha sido clonado. Continuando con la configuración.',
      );
      
    }
    this.cronJobActive = true;
    this.cronJobArguments = linkoriginalrepo;
  }

  async setupGitConfig(linkoriginalrepo: string) {
    const userFound = this.metadataRepository.findOne({
      where: { linkoriginalrepo: linkoriginalrepo },
    });
    const name = (await userFound).username;
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
          `git remote add ${this.copyRemoteName} ${(await userFound).linkcopyrepo}`,
        ];


      } else {
        commands = [
          `git config user.name "${name}"`,
          `git config user.email "${mail}"`,
          // Omitir el comando de añadir el remoto ya que ya existe
        ];
      }
      this.executeCommandsSequentially(commands, async () => {
        const hasCommits = await this.checkIfCommitsExist();
        if (!hasCommits) {
          this.processInitialCommits(name, mail);
        } else {
          console.log('Config already set up. Skipping initial commits processing.');
        }
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

  async checkIfCommitsExist(): Promise<boolean> {
    // Verificar en la base de datos si ya existen commits procesados
    const commitCount = await this.commitRepository.count();
    return commitCount > 0;
  }

  processInitialCommits(name, mail) {
    const logListOfCommitsInOrigin = `git log --pretty=format:"%H %ae"`;
    exec(logListOfCommitsInOrigin, (logError, logStdout, logStderr) => {
      if (logError) {
        this.logger.error(`Error fetching commits: ${logError.message}`);
        return;
      }
      const commits = logStdout
        .trim()
        .split('\n')
        .filter((commit) => commit !== '');
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
        exec(amendCommand, async (amendError, amendStdout, amendStderr) => {
          if (amendError) {
            this.logger.error(`Error amending commit: ${amendError.message}`);
            return;
          }
          await this.markCommitAsVisited(firstCommitHash).catch((error) =>
            this.logger.error(
              `Error marking commit as visited: ${error.message}`,
            ),
          );

          this.alreadyVisitedCommits.push(firstCommitHash);
        });
      });
    });
  }

  private async checkoutLastProcessedCommit() {
    const lastVisitedCommit = await this.commitRepository.findOne({
      where: { visited: true },
      order: { id: 'DESC' },
    });

    if (lastVisitedCommit) {
      this.logger.log(
        `Checking out to last visited commit: ${lastVisitedCommit.commitHash}`,
      );
      exec(
        `git checkout ${lastVisitedCommit.commitHash}`,
        { cwd: this.gitRepoPath },
        (error, stdout, stderr) => {
          
          if (error) {
            this.logger.error(
              `Error checking out to last visited commit: ${error.message}`,
            );
            return;
          }
          exec(`git checkout main`, { cwd: this.gitRepoPath }, (error, stdout, stderr) => {
            if (error) {
              this.logger.error(`Error returning to 'main' branch: ${error.message}`);
              return;
            }
            this.logger.log(`Successfully returned to 'main' branch.`);
          });
        });
        
    } else {
      this.logger.log('No visited commits found, staying on current commit.');
    }
  }


  async handleCron() {
    try{
      console.log("estoy intentando");
      
    const userFound = this.metadataRepository.findOne({
      where: { linkoriginalrepo: this.cronJobArguments },
    });
    if (!userFound) {
      this.logger.debug('No se encontró el usuario, saltando la ejecución del cron job.');
      return; 
    }
    const username = (await userFound).username;
    const mail = (await userFound).email;

    if (!this.cronJobActive) {
      this.logger.debug('Cron job is paused, skipping execution.');
      return; // Detiene la ejecución si el cron job está pausado
    }

    this.logger.debug('Running cron job');
    console.log('pending commits', this.pendingVisitCommits);
    console.log('already visited commits', this.alreadyVisitedCommits);
    await this.checkForNewCommits(mail, username);
  } catch (error) {
    this.logger.debug(`waiting repositories to be cloned`);
  }
}
  private async markCommitAsVisited(commitHash: string) {
    let commit = await this.commitRepository.findOne({ where: { commitHash } });
    if (!commit) {
      commit = this.commitRepository.create({ commitHash, visited: true });
    } else {
      commit.visited = true;
    }
    await this.commitRepository.save(commit);
  }

  private async checkForNewCommits(mail: string, username: string) {
    const gitFetchCommand = 'git fetch';
    exec(gitFetchCommand, { cwd: this.gitRepoPath }, (fetchError) => {
      if (fetchError) {
        this.logger.error(`Error fetching from remote: ${fetchError.message}`);
        return;
      }

      const logListOfCommitsInOrigin = `git log ${this.originRemoteName}/main --pretty=format:"%H"`;
      exec(
        logListOfCommitsInOrigin,
        { cwd: this.gitRepoPath },
        (logError, logStdout) => {
          if (logError) {
            this.logger.error(`Error fetching commits: ${logError.message}`);
            return;
          }

          const listOfCommitsInOrigin = logStdout
            .trim()
            .split('\n')
            .filter((commit) => commit !== '');
          if (listOfCommitsInOrigin.length === 0) {
            this.logger.log('No new commits to process');
            return;
          }

          const commitsToVisit = listOfCommitsInOrigin.filter(
            (commit) =>
              !this.alreadyVisitedCommits.includes(commit) &&
              !this.pendingVisitCommits.includes(commit),
          );
          this.pendingVisitCommits = [
            ...this.pendingVisitCommits,
            ...commitsToVisit.reverse(),
          ];

          if (this.pendingVisitCommits.length === 0) {
            this.logger.log('nothing to visit');
            return;
          }

          const commitToVisit = this.pendingVisitCommits.shift();
          this.logger.log(`Visiting commit ${commitToVisit}`);
          this.processCommit(commitToVisit, mail, username);
        },
      );
    });
  }
  private async loadCommits() {
    const visitedCommits = await this.commitRepository.find({
      where: { visited: true },
    });
    this.alreadyVisitedCommits = visitedCommits.map(
      (commit) => commit.commitHash,
    );

    const pendingCommits = await this.commitRepository.find({
      where: { pending: true },
    });
    this.pendingVisitCommits = pendingCommits.map(
      (commit) => commit.commitHash,
    );

    this.logger.log(
      `Loaded ${visitedCommits.length} visited and ${pendingCommits.length} pending commits from the database.`,
    );

    // Similar para commitsToBeProcessedOnSetup si es necesario
  }

  private processCommit(commitHash: string, mail: string, username: string) {
   
    const cherryPickLastCommit = `git cherry-pick ${commitHash}`;
   

    exec(
      cherryPickLastCommit,
      { cwd: this.gitRepoPath },
      async (cherryPickError, cherryPickStdout) => {
        if (cherryPickError) {
          this.logger.error(
            `Error cherry-picking commit ${commitHash}: ${cherryPickError.message}`,
          );
          return;
        }

        const logLastCommitWithAuthor = `git log -n 1 --format="%H %ae"`;
        exec(
          logLastCommitWithAuthor,
          { cwd: this.gitRepoPath },
          (logError, logStdout) => {
            if (logError) {
              this.logger.error(
                `Error logging last commit: ${logError.message}`,
              );
              return;
            }

            const [lastCommitHash, lastCommitAuthor] = logStdout
              .trim()
              .split(' ');

            if (lastCommitAuthor !== mail) {
              const gitAmendCommand = `git commit --amend --author="${username}<${mail}>" -C ${lastCommitHash}`;
              exec(
                gitAmendCommand,
                { cwd: this.gitRepoPath },
                (amendError, amendStdout) => {
                  if (amendError) {
                    this.logger.error(
                      `Error amending commit: ${amendError.message}`,
                    );
                    return;
                  }
                  const gitPushCommand = `git push ${this.copyRemoteName} main`;

              
                  exec(
                    gitPushCommand,
                    { cwd: this.gitRepoPath },
                    (pushError, pushStdout) => {
                      if (pushError) {
                        this.logger.error(
                          `Error pushing to copy repo: ${pushError.message}`,
                        );
                        return;
                      }
                      this.logger.log(
                        `Commit ${lastCommitHash} amended and pushed`,
                      );
                    },
                  );
                },
              );
            } else {
              this.logger.log(
                `Commit ${lastCommitHash} by ${lastCommitAuthor} matches the author email. Skipping amend.`,
              );
            }
          },
        );
        await this.markCommitAsVisited(commitHash).catch((error) =>
          this.logger.error(
            `Error marking commit as visited: ${error.message}`,
          ),
        );

        this.alreadyVisitedCommits.push(commitHash);
      },
    );
  }
  
  
}
