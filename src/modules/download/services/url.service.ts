import fs, { createWriteStream, existsSync, mkdirSync } from 'fs';
import axios from 'axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import pathToFfmpeg from 'ffmpeg-static';
import * as pathToFfprobe from 'ffprobe-static';
import * as Ffmpeg from 'fluent-ffmpeg';
import { PUB_SUB } from 'modules/subscription';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import * as path from 'path';

export interface DownloadInterface {
  url: string;
  organizationId: string;
  fileNameCustom?: string;
}

@Injectable()
export class UrlService {
  private _ffmpeg: Ffmpeg.FfmpegCommand;

  constructor(@Inject(PUB_SUB) private _pubSub: RedisPubSub) {
    this._ffmpeg = Ffmpeg();
    this._ffmpeg.setFfmpegPath(pathToFfmpeg);
    this._ffmpeg.setFfprobePath(pathToFfprobe.path);
  }

  /**
   *
   * @param url
   * @param organizationId
   * @param progressCallback
   */
  async downloadVideo(
    { url, organizationId, fileNameCustom }: DownloadInterface,
    progressCallback?: (process: number) => void,
  ) {
    const storageDir = `storage/${organizationId}`;
    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true });
    }
    const fileName = fileNameCustom || path.basename(url);
    const destinationPath = `${storageDir}/${fileName}`;
    return new Promise(async (resolve, reject) => {
      try {
        const response = await axios.get(url, {
          responseType: 'stream',
          onDownloadProgress: async (progressEvent) => {
            // Implement progress tracking logic
            const percent = Math.round(
              (progressEvent.loaded / progressEvent.total) * 100,
            );
            progressCallback && progressCallback(percent);
            Logger.log(
              `Downloading file ${fileName} ...${Math.abs(percent)} % done.`,
              UrlService.name,
            );
            // TODO: Subscription "MEDIA DOWNLOAD PROCESS"
            // await this._pubSub.publish('DOWNLOAD_PROGRESS', {
            //   data: {
            //     media,
            //     progress: `${Math.abs(percent)}`,
            //   },
            // });
          },
        });
        // Pipe the response stream to the file stream
        const fileStream = createWriteStream(destinationPath);
        response.data.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve({ filePath: `${organizationId}/${fileName}` });
        });
        // Handle errors during the download
        fileStream.on('error', (error) => {
          fs.unlinkSync(destinationPath); // Delete the file in case of an error
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}
