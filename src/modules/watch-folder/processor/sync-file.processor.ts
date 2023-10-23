import {
  InjectQueue,
  OnQueueCompleted,
  Process,
  Processor,
} from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { WatchFolderService } from 'modules/watch-folder/services';
import { timeout } from 'rxjs';
import { Inject, Logger } from '@nestjs/common';
import { MediaFileStatus, MediaStatus } from 'shared/enum/file';
import { ValidatorService } from 'utils/validator.service';
import { FfmpegService } from 'utils/ffmpeg.service';
import { ClientProxy } from '@nestjs/microservices';
import { v4 as uuid } from 'uuid';

@Processor('sync')
export class SyncFileProcessor {
  constructor(
    @InjectQueue('sync') private readonly _syncQueue: Queue,
    private readonly _watchService: WatchFolderService,
    private readonly _validatorService: ValidatorService,
    private readonly _ffmpegService: FfmpegService,
    @Inject('API_SERVICE') private readonly _APIService: ClientProxy,
    @Inject('TRANSCODE_SERVICE')
    private readonly _transcodeService: ClientProxy,
  ) {}

  @Process({
    name: 'syncToStorage',
    concurrency: 5,
  })
  async syncToStorage(job: Job) {
    const { organizationId, path } = job.data;
    return await this._watchService.syncFileToStorage({
      srcPath: path,
      organizationId,
    });
  }

  @OnQueueCompleted()
  async onSyncComplete(job: Job, result: { success: any; data: any }) {
    const { templateId, organizationId, userId } = job.data;
    const { success, data } = result;
    if (success) {
      const { filenameWithoutExtension, filename, mimeType, fileSizeInBytes } =
        await this._ffmpegService.getFileInfo(
          `${process.cwd()}/storage/${data}`,
        );

      // TODO: Create media
      const media = await this._APIService
        .send('CREATE_MEDIA', {
          path: data,
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
        // TODO: Update media to "TRANSCODING"
        await this._APIService
          .send('UPDATE_MEDIA', {
            contentId: media.contentId,
            status: MediaFileStatus.TRANSCODING,
          })
          .pipe(timeout(15000))
          .toPromise()
          .then((result) => {
            const { error, message, data } = result;
            if (error) {
              Logger.debug(
                `Update media status [TRANSCODING] with error : ${message}`,
              );
              return;
            }
            return data;
          })
          .catch((error) => {
            Logger.debug(
              `Update media status [TRANSCODING] with error : ${error.message}`,
            );
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

        // TODO: Create media profile
        const { codec: codecs, presets, packs } = template;
        const { _id: mediaId } = media;
        await Promise.all(
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
                    Logger.debug(
                      `Create media profile with error : ${message}`,
                    );
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
        const packsPromise = packs.map(async (pack: string) => {
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
        });

        await Promise.all(packsPromise);

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

        // TODO: Call to service transcode
        await this._transcodeService
          .send('TRANSCODE_MEDIA_FILE', {
            media: mediaTranscode,
          })
          .toPromise()
          .catch((error) => {
            Logger.debug(
              `Transcode media profile with error : ${error.message}`,
            );
          });
      }
    }
  }
}
