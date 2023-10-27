import {
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
  Process,
  Processor,
} from '@nestjs/bull';
import { Job } from 'bull';
import { Inject, Logger } from '@nestjs/common';
import { SocialSource } from 'shared/enum';
import { ClientProxy } from '@nestjs/microservices';
import { FacebookService, UrlService, YoutubeService } from '../services';
import { GetInfoFromUrl } from 'helpers/url';
import { FfmpegService } from 'utils/ffmpeg.service';
import { ValidatorService } from 'utils/validator.service';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuid } from 'uuid';
import { MediaStatus } from 'shared/enum/file';
import { timeout } from 'rxjs';

@Processor('download_video')
export class DownloadProcessor {
  private readonly _logger: Logger = new Logger(DownloadProcessor.name);

  constructor(
    private readonly _youtubeService: YoutubeService,
    private readonly _urlService: UrlService,
    private readonly _facebookService: FacebookService,
    private readonly _ffmpegService: FfmpegService,
    private readonly _validatorService: ValidatorService,
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
    Logger.log(`Download video ${job.data.url}...`);
    const { url, organizationId } = job.data;
    const { type } = await GetInfoFromUrl(url);

    const storageDir = `storage/${organizationId}`;

    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true });
    }

    switch (type) {
      case SocialSource.YOUTUBE:
        return await this._youtubeService.download(url, storageDir);
      case SocialSource.FACEBOOK:
        const { videoUrl } = await this._facebookService.getVideoUrl(url);
        return await this._urlService.download(videoUrl, storageDir);
      default:
        return await this._urlService.download(url, storageDir);
    }
  }

  @OnQueueCompleted()
  async onCompleted(job: Job, result: any) {
    const { templateId, organizationId, userId } = job.data;

    const { filenameWithoutExtension, filename, mimeType, fileSizeInBytes } =
      await this._ffmpegService.getFileInfo(
        `${process.cwd()}/storage/${result}`,
      );

    // TODO: Create media
    const media = await this._APIService
      .send('CREATE_MEDIA', {
        path: result,
        mimeType,
        name: filenameWithoutExtension,
        fileName: filename,
        contentId: uuid(),
        organizationId,
        fileSize: fileSizeInBytes,
        userId,
        description: filename,
        status: MediaStatus.UPLOADED,
      })
      .pipe(timeout(15000))
      .toPromise()
      .then((result) => {
        const { error, message, data: media } = result;
        if (error) {
          Logger.debug(`Create media with error : ${message}`);
        }

        return media;
      })
      .catch((error) => {
        Logger.debug(`Create media with error : ${error.message}`);
        return;
      });

    if (this._validatorService.canTranscode(mimeType)) {
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
                  Logger.debug(
                    `Create media packaging with error : ${message}`,
                  );
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
          contentId: media.contentId,
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

    // if (success) {
    //   const { filenameWithoutExtension, filename, mimeType, fileSizeInBytes } =
    //     await this._ffmpegService.getFileInfo(`${process.cwd()}/${data?.path}`);
    //   console.log(filenameWithoutExtension);
    //   //  TODO: Create media file
    //   const media = await this._APIService
    //     .send('CREATE_MEDIA', {
    //       mimeType,
    //       path: data?.path.replace(/^storage\//, ''),
    //       contentId: uuid(),
    //       name: filenameWithoutExtension,
    //       description: data?.title,
    //       fileName: filename,
    //       fileSize: fileSizeInBytes,
    //       organizationId,
    //       userId,
    //       status: MediaStatus.UPLOADED,
    //     })
    //     .pipe(timeout(15000))
    //     .toPromise()
    //     .then((result) => {
    //       const { error, message, data: media } = result;
    //       if (error) {
    //         Logger.debug(`Create media with error : ${message}`);
    //       }
    //       return media;
    //     })
    //     .catch((error) => {
    //       Logger.debug(`Create media with error : ${error.message}`);
    //       return;
    //     });
    //
    //   if (this._validatorService.canTranscode(mimeType)) {
    //     // TODO: Update media to "TRANSCODING"
    //     await this._APIService
    //       .send('UPDATE_MEDIA', {
    //         contentId: media.contentId,
    //         status: MediaStatus.TRANSCODING,
    //       })
    //       .pipe(timeout(15000))
    //       .toPromise()
    //       .then((result) => {
    //         const { error, message, data } = result;
    //         if (error) {
    //           Logger.debug(
    //             `Update media status [TRANSCODING] with error : ${message}`,
    //           );
    //           return;
    //         }
    //         return data;
    //       })
    //       .catch((error) => {
    //         Logger.debug(
    //           `Update media status [TRANSCODING] with error : ${error.message}`,
    //         );
    //         return;
    //       });
    //     // TODO: get template transcode
    //     const template = await this._APIService
    //       .send('GET_TRANSCODE_TEMPLATE', {
    //         id: templateId,
    //       })
    //       .pipe(timeout(15000))
    //       .toPromise()
    //       .then(async (result) => {
    //         const { error, message, data } = result;
    //         if (error) {
    //           Logger.debug(`Get media template with error : ${message}`);
    //           return;
    //         }
    //         return data;
    //       })
    //       .catch((error) => {
    //         Logger.debug(`Get media template with error : ${error.message}`);
    //         return;
    //       });
    //
    //     // TODO: Create media profile
    //     const { codec: codecs, presets, packs } = template;
    //     const { _id: mediaId } = media;
    //     await Promise.all(
    //       codecs.map(async (codec: any) => {
    //         for (const preset of presets) {
    //           const { videoBitrate, frames, audioBitrate, name, frameSize } =
    //             preset;
    //           await this._APIService
    //             .send('CREATE_MEDIA_PROFILE', {
    //               mediaId,
    //               codec,
    //               videoBitrate,
    //               frames,
    //               audioBitrate,
    //               name,
    //               frameSize,
    //             })
    //             .pipe(timeout(15000))
    //             .toPromise()
    //             .then((result) => {
    //               const { error, message } = result;
    //               if (error) {
    //                 Logger.debug(
    //                   `Create media profile with error : ${message}`,
    //                 );
    //                 return;
    //               }
    //             })
    //             .catch((error) => {
    //               Logger.debug(
    //                 `Create media profile with error : ${error.message}`,
    //               );
    //               return;
    //             });
    //         }
    //       }),
    //     );
    //
    //     // TODO: Create media packaging
    //     const packsPromise = packs.map(async (pack: string) => {
    //       for (const codec of codecs) {
    //         await this._APIService
    //           .send('CREATE_MEDIA_PACKAGING', {
    //             codec,
    //             mediaId,
    //             pack,
    //           })
    //           .pipe(timeout(15000))
    //           .toPromise()
    //           .then((result) => {
    //             const { error, message } = result;
    //             if (error) {
    //               Logger.debug(
    //                 `Create media packaging with error : ${message}`,
    //               );
    //               return;
    //             }
    //           })
    //           .catch((error) => {
    //             Logger.debug(
    //               `Create media packaging with error : ${error.message}`,
    //             );
    //             return;
    //           });
    //       }
    //     });
    //
    //     await Promise.all(packsPromise);
    //
    //     // TODO: Get media with profile and call to service transcode
    //     const mediaTranscode = await this._APIService
    //       .send('GET_MEDIA', {
    //         contentId: media.contentId,
    //       })
    //       .pipe(timeout(15000))
    //       .toPromise()
    //       .then(async (result) => {
    //         const { error, message, data } = result;
    //         if (error) {
    //           Logger.debug(`Get media with error : ${message}`);
    //           return;
    //         }
    //         return data;
    //       })
    //       .catch((error) => {
    //         Logger.debug(`Get media with error : ${error.message}`);
    //         return;
    //       });
    //
    //     // TODO: Call to service transcode
    //     await this._transcodeService
    //       .send('TRANSCODE_MEDIA_FILE', {
    //         media: mediaTranscode,
    //       })
    //       .toPromise()
    //       .catch((error) => {
    //         Logger.debug(
    //           `Transcode media profile with error : ${error.message}`,
    //         );
    //       });
    //   }
    // }
  }

  @OnQueueFailed()
  async onFailed(job: Job, err: any) {
    console.log(`=> Fail download ${job.data.url}`);
  }
}
