import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ClientProxy } from '@nestjs/microservices';
import { extractFileNameFromPath } from 'helpers/file';
import { timeout } from 'rxjs';
import { statSync } from 'fs';
import { MediaFileStatus } from 'shared/enum/file';

@Injectable()
export class DownloadService {
  constructor(
    @Inject('API_SERVICE') private readonly _APIService: ClientProxy,
    @InjectQueue('download_video') private download_video: Queue,
    @Inject('TRANSCODE_SERVICE')
    private readonly _transcodeService: ClientProxy,
  ) {}

  async downloadVideo(data: any) {
    await this.download_video.add('downloadQueue', data);
  }

  async createMedia(data: any) {
    const { path, uuid, title, organizationId, userId } = data;
    await this._APIService
      .send('CREATE_MEDIA', {
        mimeType: 'video/mp4',
        path: path.replace(/^storage\//, ''),
        contentId: uuid,
        name: uuid,
        description: title,
        fileName: extractFileNameFromPath(path),
        organizationId,
        userId,
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
  }

  async updateMedia(data: any) {
    return await this._APIService
      .send('UPDATE_MEDIA', data)
      .pipe(timeout(15000))
      .toPromise()
      .then(async (result) => {
        const { error, message, data } = result;
        if (error) {
          Logger.debug(
            `Update media status [${data?.status}] with error : ${message}`,
          );
          return;
        }
        return data;
      })
      .catch((error) => {
        Logger.debug(`Update media with error : ${error.message}`);
        return;
      });
  }

  async processAfterDownload(data: any) {
    const { path, contentId, templateId } = data;
    const fileSize = statSync(path).size;

    // TODO: Update media to "UPLOADED"

    const media = await this.updateMedia({
      contentId,
      fileSize,
      status: MediaFileStatus.UPLOADED,
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
      codecs?.map(async (codec: any) => {
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
              return result;
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
    });

    await Promise.all(packsPromise);

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

    // TODO: Call to service transcode
    await this._transcodeService
      .send('TRANSCODE_MEDIA_FILE', {
        media: mediaTranscode,
      })
      .toPromise()
      .catch((error) => {
        Logger.debug(`Transcode media profile with error : ${error.message}`);
      });
  }
}
