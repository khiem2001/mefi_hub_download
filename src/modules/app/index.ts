import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AuthModule } from 'modules/auth';
import { DownloadModule } from 'modules/download';
import { join } from 'path';
import { CommandModule } from 'nestjs-command';
import { WatchFolderModule } from 'modules/watch-folder';
import { PubSubModule } from 'modules/subscription';

@Module({
  imports: [
    AuthModule,
    DownloadModule,
    PubSubModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRootAsync({
      useFactory: () => [
        {
          rootPath: join(__dirname, '../../../', 'storage'),
          serveRoot: `/media`,
          exclude: ['/api*'],
        },
      ],
    }),
    WatchFolderModule,
    CommandModule,
  ],
})
export class AppModule {}
