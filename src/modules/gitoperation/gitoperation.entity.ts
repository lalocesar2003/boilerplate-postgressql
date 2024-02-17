import {Entity,Column,PrimaryGeneratedColumn} from 'typeorm';
@Entity()
export class Metadata {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    linkoriginalrepo: string;


    @Column()
    linkcopyrepo: string;

    @Column()
    username: string;
   
    @Column({nullable : true})
    email: string;

    @Column({type:'datetime',default: () => 'CURRENT_TIMESTAMP'})
    createAt: Date;


}


