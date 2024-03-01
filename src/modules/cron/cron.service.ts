import { Injectable, Logger } from '@nestjs/common';
import { CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { CronJob } from 'cron';
import { Metadata } from '../gitoperation/gitoperation.entity';
import { CommitEntity } from '../gitoperation/commit.entity';
import { Repository } from 'typeorm';

@Injectable()
export class CronService {
  private cronJobArguments: string = null;
  private cronJobActive = false;
  private alreadyVisitedCommits = [];
  private pendingVisitCommits = [];
  private commitsToBeProcessedOnSetup = [];
  private readonly logger = new Logger(CronService.name)
constructor(  
  @InjectRepository(Metadata)
    private metadataRepository: Repository<Metadata>,
    @InjectRepository(CommitEntity)
    private commitRepository: Repository<CommitEntity>,
 private schedulerRegistry2: SchedulerRegistry, ) {}

async onModuleInit() {
    await this.loadCommits();
    await this.checkoutLastProcessedCommit();
  
    // Crear el CronJob
    const gitServiceCronJob2 = new CronJob(CronExpression.EVERY_30_SECONDS, async () => {
      await this.handleCron2();
    });
  
    // Registrar el CronJob en el SchedulerRegistry
    this.schedulerRegistry2.addCronJob('gitServiceCronJob2', gitServiceCronJob2);
  
    // Opcionalmente, iniciar el cron job ahora o basado en alguna condición
    gitServiceCronJob2.start();
  }
    
  
  
  checkoutLastProcessedCommit() {
       console.log("checkoutlastprocessed");
       
    }
    
    
    
    loadCommits() {
       console.log("ejecutando loadcommits");
       
    }


public setCronJobActive(isActive: boolean): void {
   
    const job = this.schedulerRegistry2.getCronJob('gitServiceCronJob2'); // Asume que este es el nombre de tu cron job
  
    if (isActive) {
      job.start();
      this.logger.log('Cron job started');
    } else {
      job.stop();
      this.logger.log('Cron job stopped');
    }
  }
  async handleCron2() {
    try{
      console.log("estoy intentando");
      
    const userFound = {username:"algo",
  email:"algo"}
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
  checkForNewCommits(mail: string, username: string) {
   console.log("check se ejecuta");
   
  }

}
