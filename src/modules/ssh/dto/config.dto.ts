import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
export class configDto {
  @IsNotEmpty()
  githubusername: string;
}
