import { MessagePattern } from '@nestjs/microservices';
import { DownloadService } from '../services';

import { Body, Post } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CreateMediaFromUrlDto } from '../dtos';

export class DownloadController {
  constructor(private readonly _downloadService: DownloadService) {}

  @Post('download')
  @ApiBearerAuth()
  async download(@Body() createMediaFromUrlDto: CreateMediaFromUrlDto) {}
}
