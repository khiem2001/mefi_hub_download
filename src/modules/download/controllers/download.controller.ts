import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CreateMediaFromUrlDto } from '../dtos';
import { JwtAuthGuard } from 'modules/auth/guards';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { AuthUser } from 'decorators/auth-user.decorator';

@Controller()
export class DownloadController {
  constructor(@InjectQueue('download_video') private _downloadQueue: Queue) {}

  @Post('download')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transcode media',
  })
  async createMediaFromUrl(
    @Body() createMediaFromUrlDto: CreateMediaFromUrlDto,
    @AuthUser() userId: any,
  ) {
    const { urls, organizationId, templateId } = createMediaFromUrlDto;
    for (const url of urls) {
      await this._downloadQueue.add('downloadQueue', {
        url,
        organizationId,
        templateId,
        userId,
      });
    }
  }
}
