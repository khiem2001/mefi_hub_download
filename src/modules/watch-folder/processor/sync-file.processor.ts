import {
  OnQueueActive,
  OnQueueCompleted,
  Process,
  Processor
} from '@nestjs/bull';
import { Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Job } from 'bull';
import { writeFileName } from 'helpers/file';
import { WatchFolderService } from 'modules/watch-folder/services';
import { basename, extname } from 'path';
import { MediaStatus } from 'shared/enum/file';
import { FfmpegService } from 'utils/ffmpeg.service';
import { v4 as uuid } from 'uuid';
@Processor('sync')
export class SyncFileProcessor {
  constructor(
    private readonly _watchService: WatchFolderService,
    private readonly _ffmpegService: FfmpegService,
    @Inject('API_SERVICE') private readonly _APIService: ClientProxy,
    @Inject('TRANSCODE_SERVICE')
    private readonly _transcodeService: ClientProxy,
  ) {}

  @Process({
    name: 'syncToStorage',
    concurrency: 5,
  })
  @OnQueueActive()
  async syncToStorage(job: Job) {
    const { organizationId, path: inputPath } = job.data;
    const originalName = basename(inputPath, extname(inputPath));
   
    const response = await this._watchService.saveFileToFolder({
      srcPath: inputPath,
      organizationId,
    });

    return {response, originalName}
  }

  @OnQueueCompleted()
  async onSyncComplete(job: Job, result: any) {
    const { templateId, organizationId, userId, path } = job.data;
    const {response, originalName} = result

    const { filename, mimeType, fileSizeInBytes } =
      await this._ffmpegService.getFileInfo(
        `${process.cwd()}/storage/${response}`,
      );

    // TODO: Create media
    await this._APIService
      .send('CREATE_MEDIA', {
        path: response,
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

    return writeFileName(path, organizationId);
  }
}
