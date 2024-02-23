import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
export class cloneDto {
  @IsNotEmpty()
  linkoriginalrepo: string;
}
