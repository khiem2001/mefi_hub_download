import { MessagePattern } from '@nestjs/microservices';
import { DownloadService } from '../services';
import { Request } from 'express';
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CreateMediaFromUrlDto } from '../dtos';
import { JwtAuthGuard } from 'modules/auth/guards';
@Controller()
export class DownloadController {
  constructor(private readonly _downloadService: DownloadService) {}

  @Post('download')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async createMediaFromUrl(
    @Req() req: any,
    @Body() body: CreateMediaFromUrlDto,
  ) {
    const { _id: userId } = req.user;
    const { urls, organizationId, templateId } = body;
    await Promise.all(
      urls.map(async (url) => {
        await this._downloadService.downloadVideo({
          url,
          organizationId,
          templateId,
          userId,
        });
      }),
    );

    return { success: true };
  }
}
