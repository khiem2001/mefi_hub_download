import { Body, Controller, Post } from "@nestjs/common";
import { FolderService } from "./folder.service";
import { MessagePattern } from "@nestjs/microservices";

@Controller('watch-folder')
export class FolderController {
    constructor(private folderService: FolderService) { }

    @MessagePattern('GET_FILE_USED')
    async downloadFileFromFolder(request: any): Promise<any> {
        const { input, userId } = request
        return await this.folderService.downloadFileFromFoler(input, userId)
    }
}