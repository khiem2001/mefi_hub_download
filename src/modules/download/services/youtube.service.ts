import { Inject, Injectable } from '@nestjs/common';
import * as ytdl from 'ytdl-core';
import { v4 as uuid } from 'uuid';
import * as fs from 'fs';
import { PUB_SUB } from 'modules/subscription';
import { RedisPubSub } from 'graphql-redis-subscriptions';

@Injectable()
export class YoutubeService {
  constructor(@Inject(PUB_SUB) private _pubSub: RedisPubSub) {}

  /**
   * Download video
   * @param media
   * @param progressCallback
   */
  async downloadVideo(
    media: any,
    progressCallback?: (percent: number) => void,
  ) {
    const { source, organizationId } = media;
    const storageDir = `storage/${organizationId}`;
    const prefix: string = uuid();

    const fileName = `${prefix}.mp4`;

    const videoStream = ytdl(source, {
      quality: 'highest',
      filter: 'audioandvideo',
    });

    const destinationPath = `${storageDir}/${fileName}`;

    const fileStream = fs.createWriteStream(destinationPath);

    videoStream.on('progress', async (chunkLength, downloaded, total) => {
      const percent = (downloaded / total) * 100;
      progressCallback && progressCallback(percent);
      // TODO: Subscription "MEDIA DOWNLOAD PROCESS"
      await this._pubSub.publish('DOWNLOAD_PROGRESS', {
        data: {
          media,
          progress: `${Math.abs(percent)}`,
        },
      });
    });

    return new Promise<{ path: string; media: any }>((resolve, reject) => {
      videoStream.pipe(fileStream);

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

  /**
   * Get video metadata from link youtube
   * @param videoUrl
   */
  async getYoutubeVideoMetadata(videoUrl: string): Promise<{
    name: string;
    durationInSeconds: number;
    frameSize: {
      width: number;
      height: number;
    };
  }> {
    const info = await ytdl.getInfo(videoUrl);

    const highestQualityFormat = ytdl.chooseFormat(info.formats, {
      quality: 'highestvideo',
    });

    return {
      name: info.videoDetails.title,
      durationInSeconds: parseInt(info.videoDetails.lengthSeconds),
      frameSize: {
        width: highestQualityFormat?.width,
        height: highestQualityFormat?.height,
      },
    };
  }
}
