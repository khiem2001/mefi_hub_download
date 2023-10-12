import {
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
  Process,
  Processor,
} from '@nestjs/bull';
import { Job } from 'bull';
import { existsSync } from 'fs';
import { Inject, Logger } from '@nestjs/common';
import {
  downloadFromUrl,
  downloadFromYoutube,
  getVideoUrlFromFacebook,
} from 'helpers/download';
import { SocialSource } from 'shared/enum';
import { ClientProxy } from '@nestjs/microservices';
import { MediaFileStatus } from 'shared/enum/file';
import { timeout } from 'rxjs';
import { DownloadService } from '../services';

@Processor('download_video')
export class DownloadProcessor {
  private readonly _logger: Logger = new Logger(DownloadProcessor.name);

  constructor(
    private readonly _downloadService: DownloadService,
    @Inject('API_SERVICE') private readonly _APIService: ClientProxy,
  ) {}

  @Process({
    name: 'downloadQueue',
    concurrency: 3,
  })
  @OnQueueActive()
  async onActive(job: Job) {
    console.log(`Download video ${job.data.type}...`);

    const { type, url, path, contentId } = job.data;
    try {
      switch (type) {
        case SocialSource.YOUTUBE:
          await downloadFromYoutube(url, path);
          break;
        case SocialSource.MP4:
          await downloadFromUrl(url, path);
          break;
        case SocialSource.FACEBOOK:
          const { videoUrl } = await getVideoUrlFromFacebook(url, path);
          await downloadFromUrl(videoUrl, path);
          break;
        default:
          throw Error('Invalid Video');
      }
    } catch (err) {
      //  TODO: Update media to "ERROR"
      await this._APIService
        .send('UPDATE_MEDIA', {
          contentId,
          status: MediaFileStatus.ERROR,
        })
        .pipe(timeout(15000))
        .toPromise()
        .then(async (result) => {
          const { error, message, data } = result;
          if (error) {
            Logger.debug(`Update media status [ERROR] with error : ${message}`);
            return;
          }
          return data;
        })
        .catch((error) => {
          Logger.debug(`Update media with error : ${error.message}`);
          return;
        });
    }
  }

  @OnQueueCompleted()
  async onCompleted(job: Job) {
    const { type, url, path, contentId, templateId } = job.data;

    console.log(`=> Complete download ${job.data.type}`);
    if (existsSync(path)) {
      await this._downloadService.processAfterDownload(job.data);
    }
  }

  @OnQueueFailed()
  async onFailed(job: Job, err: any) {
    console.log(`=> Fail download ${job.data.type}`);
  }
}
