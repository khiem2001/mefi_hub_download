import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { DownloadModule } from 'modules/download';
import { FolderModule } from 'modules/folder/folder.module';
import { CommandModule } from 'nestjs-command';
import { join } from 'path';

@Module({
  imports: [
    DownloadModule,
    CommandModule,
    FolderModule,
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
  ],
})
export class AppModule { }
