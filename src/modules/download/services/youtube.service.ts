import { Inject, Injectable } from '@nestjs/common';
import * as ytdl from 'ytdl-core';
import { v4 as uuid } from 'uuid';
import { PUB_SUB } from 'modules/subscription';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import fs, { createWriteStream, existsSync, mkdirSync } from 'fs';

@Injectable()
export class YoutubeService {
  constructor(@Inject(PUB_SUB) private _pubSub: RedisPubSub) {}

  /**
   * Download video
   * @param media
   * @param progressCallback
   */
  async downloadVideo(
    { url, organizationId },
    progressCallback?: (percent: number) => void,
  ) {
    const storageDir = `storage/${organizationId}`;
    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true });
    }

    const info = await ytdl.getInfo(url);
    const videoStream = ytdl(url, {
      quality: 'highestvideo',
      filter: 'audioandvideo',
    });
    const fileName = `${info?.videoDetails?.videoId}.mp4`;
    const name = info?.videoDetails?.title || 'Video Youtube';

    const destinationPath = `${storageDir}/${fileName}`;

    const fileStream = createWriteStream(destinationPath);

    videoStream.on('progress', async (chunkLength, downloaded, total) => {
      const percent = (downloaded / total) * 100;
      progressCallback && progressCallback(percent);
      // TODO: Subscription "MEDIA DOWNLOAD PROCESS"
      // await this._pubSub.publish('DOWNLOAD_PROGRESS', {
      //   data: {
      //     media,
      //     progress: `${Math.abs(percent)}`,
      //   },
      // });
    });

    return new Promise<{ filePath: string; name: string }>(
      (resolve, reject) => {
        videoStream.pipe(fileStream);

        fileStream.on('finish', () => {
          resolve({
            filePath: `${organizationId}/${fileName}`,
            name,
          });
        });

        fileStream.on('error', (err) => {
          reject(err);
        });
      },
    );
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
