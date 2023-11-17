import { Module } from '@nestjs/common';
import { ClientsModule, ClientsModuleOptions } from '@nestjs/microservices';
import { DownloadController } from './controllers';
import { FacebookService, UrlService, YoutubeService } from './services';
import { ValidatorService } from 'utils/validator.service';
import { TRANSPORT_SERVICE } from 'configs/transport.config';
import { DownloadProcessor } from './processor';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CreateSymlinkStorageCommand } from './commands';
import { FfmpegService } from 'utils/ffmpeg.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: 'download_video' }),
    ClientsModule.register([
      TRANSPORT_SERVICE['API_SERVICE'].nats,
      TRANSPORT_SERVICE['TRANSCODE_SERVICE'].nats,
    ] as ClientsModuleOptions),
  ],
  controllers: [DownloadController],
  providers: [
    YoutubeService,
    UrlService,
    FacebookService,
    DownloadProcessor,
    CreateSymlinkStorageCommand,
    FfmpegService,
    ValidatorService,
  ],
})
export class DownloadModule {}
