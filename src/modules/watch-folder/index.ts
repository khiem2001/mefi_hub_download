import { Module } from '@nestjs/common';
import { WatchFolderController } from 'modules/watch-folder/controllers';
import { WatchFolderService } from 'modules/watch-folder/services';
import { SyncFileProcessor } from 'modules/watch-folder/processor';
import { BullModule } from '@nestjs/bull';
import { ValidatorService } from 'utils/validator.service';
import { ClientsModule, ClientsModuleOptions } from '@nestjs/microservices';
import { TRANSPORT_SERVICE } from 'configs/transport.config';
import { FfmpegService } from 'utils/ffmpeg.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'sync' }),
    ClientsModule.register([
      TRANSPORT_SERVICE['API_SERVICE'].redis,
      TRANSPORT_SERVICE['TRANSCODE_SERVICE'].redis,
    ] as ClientsModuleOptions),
  ],
  controllers: [WatchFolderController],
  providers: [
    WatchFolderService,
    SyncFileProcessor,
    ValidatorService,
    FfmpegService,
  ],
})
export class WatchFolderModule {}
