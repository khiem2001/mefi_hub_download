import { Module } from '@nestjs/common';
import { ClientsModule, ClientsModuleOptions } from '@nestjs/microservices';
import { DownloadController } from './controllers';
import { DownloadService } from './services';
import { ValidatorService } from 'utils/validator.service';
import { TRANSPORT_SERVICE } from 'configs/transport.config';
import { DownloadProcessor } from './processor';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CreateSymlinkStorageCommand } from './commands';

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
      TRANSPORT_SERVICE['API_SERVICE'].redis,
      TRANSPORT_SERVICE['TRANSCODE_SERVICE'].redis,
    ] as ClientsModuleOptions),
  ],
  controllers: [DownloadController],
  providers: [
    DownloadService,
    ValidatorService,
    DownloadProcessor,
    CreateSymlinkStorageCommand,
  ],
})
export class DownloadModule {}
