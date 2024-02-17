import { Body, Controller, Get, Post } from '@nestjs/common';
import { GitService } from './gitoperation.service';
import { metadataDto } from './dto/metadata.dto';
import { cloneDto } from './dto/clone.dto';
@Controller('gitoperation')
export class GitoperationController {
    
    constructor(private gitoperation:GitService){}

@Post('metadata')
getrepostandmetada(@Body() newuser:metadataDto){

    return this.gitoperation.createMetadata(newuser)
}
@Post('clone')
cloneandsetup(@Body() username:cloneDto){
    return this.gitoperation.cloneAndSetupRepo(username)
}

}