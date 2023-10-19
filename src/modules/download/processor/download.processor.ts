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
  genPathMp4,
  getVideoUrlFromFacebook,
} from 'helpers/download';
import { SocialSource } from 'shared/enum';
import { ClientProxy } from '@nestjs/microservices';
import { MediaFileStatus } from 'shared/enum/file';
import { timeout } from 'rxjs';
import { DownloadService } from '../services';
import { GetInfoFromUrl } from 'helpers/url';
import { getFileNameWithoutExtension } from 'helpers/file';

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
    console.log(`Download video ${job.data.url}...`);

    const { url, organizationId, templateId, userId } = job.data;
    const { title, type } = await GetInfoFromUrl(url);
    const path = genPathMp4(organizationId);
    const uuid = getFileNameWithoutExtension(path);

    //  TODO: Create media file
    await this._downloadService.createMedia({
      path,
      uuid,
      title,
      organizationId,
      userId,
    });

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

      //  TODO: Process after download
      if (existsSync(path)) {
        this._downloadService.processAfterDownload({
          path,
          contentId: uuid,
          templateId,
        });
      }
    } catch (err) {
      //  TODO: Update media to "ERROR"
      await this._downloadService.updateMedia({
        contentId: uuid,
        status: MediaFileStatus.ERROR,
      });
    }
  }

  @OnQueueCompleted()
  async onCompleted(job: Job) {
    console.log(`=> Complete download ${job.data.url}`);
  }

  @OnQueueFailed()
  async onFailed(job: Job, err: any) {
    console.log(`=> Fail download ${job.data.url}`);
  }
}
