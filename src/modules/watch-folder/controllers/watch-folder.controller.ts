import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { WatchFolderService } from 'modules/watch-folder/services';
import { SyncFileDto } from 'modules/watch-folder/dtos';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { JwtAuthGuard } from 'modules/auth/guards';
import { AuthUser } from 'decorators/auth-user.decorator';

@Controller()
@ApiBearerAuth()
export class WatchFolderController {
  constructor(
    @InjectQueue('sync') private readonly _syncQueue: Queue,
    private readonly _watchService: WatchFolderService,
  ) {}

  @Get('files')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Get media file',
  })
  @ApiQuery({
    name: 'folder',
    type: String,
    description: 'Folder name',
    required: false,
  })
  @ApiQuery({
    name: 'filterName',
    type: String,
    description: 'Filter name',
    required: false,
  })
  async getListFile(
    @Query('folder') folder: string,
    @Query('filterName') filterName: string,
  ) {
    return await this._watchService.listDirectory(folder, filterName);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transcode media',
  })
  @UseGuards(JwtAuthGuard)
  async syncFileToStorage(
    @Body() syncFileDto: SyncFileDto,
    @AuthUser() userId: any,
  ) {
    const { paths, templateId, organizationId } = syncFileDto;
    for (const path of paths) {
      await this._syncQueue.add('syncToStorage', {
        path,
        organizationId,
        userId,
        templateId,
      });
    }
  }
}
