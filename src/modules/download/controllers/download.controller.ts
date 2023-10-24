import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CreateMediaFromUrlDto } from '../dtos';
import { JwtAuthGuard } from 'modules/auth/guards';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Controller()
export class DownloadController {
  constructor(@InjectQueue('download_video') private download_video: Queue) {}

  @Post('download')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transcode media',
  })
  async createMediaFromUrl(
    @Req() req: any,
    @Body() body: CreateMediaFromUrlDto,
  ) {
    const { _id: userId } = req.user;
    const { urls, organizationId, templateId } = body;
    await Promise.all(
      urls.map(async (url) => {
        await this.download_video.add('downloadQueue', {
          url,
          organizationId,
          templateId,
          userId,
        });
      }),
    );
  }
}
