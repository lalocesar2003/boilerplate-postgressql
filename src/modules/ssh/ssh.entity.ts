import {Entity,Column,PrimaryGeneratedColumn} from 'typeorm';
@Entity()
export class sshdata {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    githubusername: string;


    @Column()
    githubemail: string;

    @Column({type:'datetime',default: () => 'CURRENT_TIMESTAMP'})
    createAt: Date;


}

