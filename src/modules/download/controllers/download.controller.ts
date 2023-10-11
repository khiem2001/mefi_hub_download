import { MessagePattern } from '@nestjs/microservices';
import { DownloadService } from '../services';

import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CreateMediaFromUrlDto } from '../dtos';
import { JwtAuthGuard } from 'modules/auth/guards';
@Controller()
export class DownloadController {
  constructor(private readonly _downloadService: DownloadService) {}

  @Post('download')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async download(@Body() createMediaFromUrlDto: CreateMediaFromUrlDto) {}
}
