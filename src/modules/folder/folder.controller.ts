import { Body, Controller, Post } from "@nestjs/common";
import { FolderService } from "./folder.service";

@Controller('watch-folder')
export class FolderController {

    constructor(private folderService: FolderService) { }

    @Post('upload')
    async downloadFileFromFolder(@Body() input: any, userId: string): Promise<any> {
        await this.folderService.downloadFileFromFoler(input, userId)
        return { success: true }
    }
}