import { IsEmail, IsNotEmpty, IsString } from "class-validator";
export class sshDto {

    @IsNotEmpty()
    githubusername: string;

    @IsNotEmpty()
    githubemail: string;
}