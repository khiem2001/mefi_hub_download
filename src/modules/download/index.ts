import { Module } from '@nestjs/common';
import { ClientsModule, ClientsModuleOptions } from '@nestjs/microservices';
import { DownloadController } from './controllers';
import { DownloadService } from './services';
import { ValidatorService } from 'utils/validator.service';
import { TRANSPORT_SERVICE } from 'configs/transport.config';

@Module({
  imports: [
    ClientsModule.register([
      TRANSPORT_SERVICE['API_SERVICE'].redis,
      TRANSPORT_SERVICE['TRANSCODE_SERVICE'].redis,
    ] as ClientsModuleOptions),
  ],
  controllers: [DownloadController],
  providers: [DownloadService, ValidatorService],
})
export class DownloadModule {}
