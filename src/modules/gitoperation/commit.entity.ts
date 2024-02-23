import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class CommitEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  commitHash: string;

  @Column({ default: false })
  visited: boolean;

  @Column({ default: false })
  pending: boolean;

  @Column({ default: false })
  toBeProcessed: boolean;
}
