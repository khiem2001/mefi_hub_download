import * as fs from 'fs';
import axios from 'axios';
import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import * as pathToFfmpeg from 'ffmpeg-static';
import * as pathToFfprobe from 'ffprobe-static';
import * as Ffmpeg from 'fluent-ffmpeg';
import { PUB_SUB } from 'modules/subscription';
import { RedisPubSub } from 'graphql-redis-subscriptions';

@Injectable()
export class UrlService {
  private _ffmpeg: Ffmpeg.FfmpegCommand;

  constructor(@Inject(PUB_SUB) private _pubSub: RedisPubSub) {
    this._ffmpeg = Ffmpeg();
    this._ffmpeg.setFfmpegPath(pathToFfmpeg);
    this._ffmpeg.setFfprobePath(pathToFfprobe.path);
  }

  /**
   * Get video metadata from link MP4
   * @param videoURL
   */
  async getRemoteMP4Metadata(videoURL: string) {
    this._ffmpeg = Ffmpeg();

    return new Promise<{
      name: string;
      durationInSeconds: number;
      frameSize: {
        width: number;
        height: number;
      };
      mimeType: string;
    }>((resolve, reject) => {
      this._ffmpeg.input(videoURL).ffprobe((err, metadata) => {
        if (err) {
          reject(err);
        } else {
          const format = metadata.format;
          resolve({
            name: videoURL.split('/').pop(),
            mimeType: format.format_name,
            durationInSeconds: format.duration,
            frameSize: {
              width: metadata.streams[1].width,
              height: metadata.streams[1].height,
            },
          });
        }
      });
    });
  }

  /**
   * Download video
   * @param media
   * @param progressCallback
   */
  async downloadVideo(
    media: any,
    progressCallback?: (process: number) => void,
  ) {
    const { source, organizationId } = media;
    const storageDir = `storage/${organizationId}`;
    const prefix: string = uuid();

    const fileName = `${prefix}.mp4`;

    const response = await axios({
      url: source,
      method: 'GET',
      responseType: 'stream',
      onDownloadProgress: async (progressEvent) => {
        // Implement your progress tracking logic here
        const percent = Math.round(
          (progressEvent.loaded / progressEvent.total) * 100,
        );
        progressCallback && progressCallback(percent);
        // TODO: Subscription "MEDIA DOWNLOAD PROCESS"
        await this._pubSub.publish('DOWNLOAD_PROGRESS', {
          data: {
            media,
            progress: `${Math.abs(percent)}`,
          },
        });
      },
    });

    const destinationPath = `${storageDir}/${fileName}`;

    const fileStream = fs.createWriteStream(destinationPath);

    return new Promise<{ path: string; media: any }>((resolve, reject) => {
      response.data.pipe(fileStream);

      fileStream.on('finish', () => {
        resolve({
          path: `${destinationPath.replace(/^storage\//, '')}`,
          media: media,
        });
      });

      fileStream.on('error', (err) => {
        reject(err);
      });
    });
  }
}
