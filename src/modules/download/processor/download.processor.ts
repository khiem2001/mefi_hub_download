import {
  OnQueueActive,
  OnQueueCompleted,
  Process,
  Processor,
} from '@nestjs/bull';
import { Job } from 'bull';
import { Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { FacebookService, UrlService, YoutubeService } from '../services';
import { GetInfoFromUrl } from 'helpers/url';
import { FfmpegService } from 'utils/ffmpeg.service';
import { v4 as uuid } from 'uuid';
import { MediaStatus } from 'shared/enum/file';
import { basename } from 'path';

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
    private readonly _ffmpegService: FfmpegService,
  ) {}

  @Process({
    name: 'downloadQueue',
    concurrency: 2,
  })
  @OnQueueActive()
  async onActive(job: Job) {
    const { url, organizationId } = job.data;
    const { type } = await GetInfoFromUrl(url);

    switch (type) {
      // case SocialSource.FACEBOOK:
      //   return await this._youtubeService.downloadVideo(
      //     media,
      //     (process: number) => {
      //       console.log('process', process);
      //     },
      //   );
      // case SocialSource.YOUTUBE:
      //   return await this._youtubeService.downloadVideo(
      //     media,
      //     (process: number) => {
      //       console.log('process', process);
      //     },
      //   );
      default:
        return await this._urlService.downloadVideo({ url, organizationId });
    }
  }

  @OnQueueCompleted()
  async completed(job: Job, result: any) {
    const { organizationId, userId, templateId } = job.data;
    const { filePath } = result;
    const { filename, mimeType, fileSizeInBytes } =
      await this._ffmpegService.getFileInfo(
        `${process.cwd()}/storage/${filePath}`,
      );
    const originalName = basename(filePath);
    // TODO: Create media
    await this._APIService
      .send('CREATE_MEDIA', {
        path: filePath,
        mimeType,
        name: originalName,
        fileName: filename,
        contentId: uuid(),
        organizationId,
        fileSize: fileSizeInBytes,
        userId,
        description: originalName,
        status: MediaStatus.UPLOADED,
        templateId,
      })
      .toPromise()
      .then(async (result) => {
        // TODO call to generate thumbnail
        const media = await this._APIService
          .send('GET_MEDIA', {
            mediaId: result._id.toString(),
          })
          .toPromise()
          .catch((error) => {
            return;
          });

        // TODO call to generate thumbnail
        await this._transcodeService
          .send('GENERATE_THUMBNAIL', {
            media,
          })
          .toPromise()
          .catch((error) => {
            return;
          });

        // TODO call to transcode
        await this._transcodeService
          .send('START_TRANSCODE_FILE', {
            media,
          })
          .toPromise()
          .catch((error) => {
            return;
          });
      })
      .catch((error) => {
        Logger.debug(`Create media with error : ${error.message}`);
        return;
      });
  }
}
