import { IsEmail, IsNotEmpty, IsString } from "class-validator";
export class metadataDto {
    @IsNotEmpty()
    linkoriginalrepo: string;

    @IsNotEmpty()
    linkcopyrepo:string

    @IsNotEmpty()
    username: string;

    
    @IsEmail()
    @IsNotEmpty()
    @IsString()
    mail: string;

}