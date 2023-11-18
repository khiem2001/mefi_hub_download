import {
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
  Process,
  Processor,
} from '@nestjs/bull';
import { Job } from 'bull';
import { Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { FacebookService, UrlService, YoutubeService } from '../services';
import { GetInfoFromUrl } from 'helpers/url';
import { existsSync, mkdirSync } from 'fs';
import { MediaStatus } from 'shared/enum/file';
import { timeout } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { SocialSource } from 'shared/enum';
import * as path from 'path';

@Processor('download_video')
export class DownloadProcessor {
  private readonly _logger: Logger = new Logger(DownloadProcessor.name);

  constructor(
    private readonly _youtubeService: YoutubeService,
    private readonly _urlService: UrlService,
    private readonly _facebookService: FacebookService,
    @Inject('API_SERVICE') private readonly _APIService: ClientProxy,
    @Inject('TRANSCODE_SERVICE')
    private readonly _transcodeService: ClientProxy,
  ) {}

  @Process({
    name: 'downloadQueue',
    concurrency: 5,
  })
  @OnQueueActive()
  async onActive(job: Job) {
    const { url, organizationId, userId, templateId } = job.data;
    const { type } = await GetInfoFromUrl(url);

    const storageDir = `storage/${organizationId}`;

    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true });
    }

    let fileMetadata: {
      name: any;
      durationInSeconds: any;
      frameSize: any;
      mimeType?: string;
    };

    switch (type) {
      case SocialSource.YOUTUBE:
        fileMetadata = await this._youtubeService.getYoutubeVideoMetadata(url);
        break;
      case SocialSource.FACEBOOK:
        fileMetadata = await this._urlService.getRemoteMP4Metadata(url);
        break;
      default:
        fileMetadata = await this._urlService.getRemoteMP4Metadata(url);
        break;
    }
    const { name, durationInSeconds, frameSize } = fileMetadata;
    const template = await this._APIService
      .send('GET_TRANSCODE_TEMPLATE', {
        id: templateId,
      })
      .pipe(timeout(15000))
      .toPromise()
      .then(async (result) => {
        const { error, message, data } = result;
        if (error) {
          Logger.debug(`Get media template with error : ${message}`);
          return;
        }
        return data;
      })
      .catch((error) => {
        Logger.debug(`Get media template with error : ${error.message}`);
        return;
      });

    const { isDRM } = template;
    return await this._APIService
      .send('CREATE_MEDIA', {
        mimeType: 'video/mp4',
        name,
        contentId: uuid(),
        organizationId,
        userId,
        description: name,
        durationInSeconds,
        frameSize,
        source: url,
        status: MediaStatus.UPLOADING,
        hasDRM: isDRM,
      })
      .pipe(timeout(15000))
      .toPromise()
      .then(async (result) => {
        const { error, message, data } = result;
        if (error) {
          Logger.debug(`Create media with error : ${message}`);
          return;
        }
        return await this.downloadVideoProcess(type, data);
      });
  }

  @OnQueueCompleted()
  async onCompleted(job: Job, result: any) {
    const { templateId } = job.data;
    const { path: destinationPath, media: mediaData } = result;

    const { contentId } = mediaData;

    // TODO: Update media to "UPLOADED"
    const media = await this._APIService
      .send('UPDATE_MEDIA', {
        contentId,
        status: MediaStatus.UPLOADED,
        fileName: path.basename(destinationPath),
        path: destinationPath,
      })
      .pipe(timeout(15000))
      .toPromise()
      .then(async (result) => {
        const { error, message, data } = result;
        if (error) {
          Logger.debug(
            `Update media status [UPLOADED] with error : ${message}`,
          );
          return;
        }
        return data;
      })
      .catch((error) => {
        Logger.debug(`Update media with error : ${error.message}`);
        return;
      });

    // TODO: get template transcode
    const template = await this._APIService
      .send('GET_TRANSCODE_TEMPLATE', {
        id: templateId,
      })
      .pipe(timeout(15000))
      .toPromise()
      .then(async (result) => {
        const { error, message, data } = result;
        if (error) {
          Logger.debug(`Get media template with error : ${message}`);
          return;
        }
        return data;
      })
      .catch((error) => {
        Logger.debug(`Get media template with error : ${error.message}`);
        return;
      });

    // TODO: check if not have template or not have preset template
    if (!template || template.presets.length === 0) {
      return;
    }

    // TODO: Create media profile
    const { codec: codecs, presets, packs } = template;
    const { _id: mediaId } = media;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const profiles = await Promise.all(
      codecs.map(async (codec: any) => {
        for (const preset of presets) {
          const { videoBitrate, frames, audioBitrate, name, frameSize } =
            preset;
          await this._APIService
            .send('CREATE_MEDIA_PROFILE', {
              mediaId,
              codec,
              videoBitrate,
              frames,
              audioBitrate,
              name,
              frameSize,
            })
            .pipe(timeout(15000))
            .toPromise()
            .then((result) => {
              const { error, message } = result;
              if (error) {
                Logger.debug(`Create media profile with error : ${message}`);
                return;
              }
            })
            .catch((error) => {
              Logger.debug(
                `Create media profile with error : ${error.message}`,
              );
              return;
            });
        }
      }),
    );

    // TODO: Create media packaging
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const packsPromise = await Promise.all(
      packs.map(async (pack: string) => {
        for (const codec of codecs) {
          await this._APIService
            .send('CREATE_MEDIA_PACKAGING', {
              codec,
              mediaId,
              pack,
            })
            .pipe(timeout(15000))
            .toPromise()
            .then((result) => {
              const { error, message } = result;
              if (error) {
                Logger.debug(`Create media packaging with error : ${message}`);
                return;
              }
            })
            .catch((error) => {
              Logger.debug(
                `Create media packaging with error : ${error.message}`,
              );
              return;
            });
        }
      }),
    );
    // TODO: Get media with profile and call to service transcode
    const mediaTranscode = await this._APIService
      .send('GET_MEDIA', {
        contentId,
      })
      .pipe(timeout(15000))
      .toPromise()
      .then(async (result) => {
        const { error, message, data } = result;
        if (error) {
          Logger.debug(`Get media with error : ${message}`);
          return;
        }
        return data;
      })
      .catch((error) => {
        Logger.debug(`Get media with error : ${error.message}`);
        return;
      });

    // TODO: Generate Thumbnail
    this._transcodeService
      .send('GENERATE_THUMBNAIL', {
        media,
      })
      .toPromise()
      .catch((error) => {
        Logger.debug(`Generate thumbnail with error : ${error.message}`);
      });

    // TODO: Call to service transcode
    this._transcodeService
      .send('TRANSCODE_MEDIA_FILE', {
        media: mediaTranscode,
      })
      .toPromise()
      .catch((error) => {
        Logger.debug(`Transcode media profile with error : ${error.message}`);
      });
  }

  @OnQueueFailed()
  async onFailed(job: Job, err: any, result: any) {
    console.log(`=> Fail download ${job.data.url}`);
  }

  private async downloadVideoProcess(type: SocialSource, media: any) {
    switch (type) {
      case SocialSource.FACEBOOK:
        return await this._youtubeService.downloadVideo(
          media,
          (process: number) => {
            console.log('process', process);
          },
        );
      case SocialSource.YOUTUBE:
        return await this._youtubeService.downloadVideo(
          media,
          (process: number) => {
            console.log('process', process);
          },
        );
      default:
        return await this._urlService.downloadVideo(media);
    }
  }
}
