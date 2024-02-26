import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
export class sshDto {
  @IsNotEmpty()
  githubUsername: string;

  @IsNotEmpty()
  githubemail: string;
}
