import {
  InjectQueue,
  OnQueueActive,
  OnQueueCompleted,
  Process,
  Processor,
} from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { WatchFolderService } from 'modules/watch-folder/services';
import { Inject, Logger } from '@nestjs/common';
import { MediaStatus } from 'shared/enum/file';
import { ValidatorService } from 'utils/validator.service';
import { FfmpegService } from 'utils/ffmpeg.service';
import { ClientProxy } from '@nestjs/microservices';
import { v4 as uuid } from 'uuid';
import { writeFileName } from 'helpers/file';

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
  @OnQueueActive()
  async syncToStorage(job: Job) {
    const { organizationId, path } = job.data;
    return await this._watchService.syncFileToStorage({
      srcPath: path,
      organizationId,
    });
  }

  @OnQueueCompleted()
  async onSyncComplete(job: Job, result: any) {
    const { templateId, organizationId, userId, path } = job.data;

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
        templateId,
      })
      .toPromise()
      .then(async (result) => {
        // TODO call to generate thumbnail
        await this._APIService
          .send('GENERATE_THUMBNAIL', {
            mediaId: result._id,
          })
          .toPromise()
          .catch((error) => {
            return;
          });
        // TODO call to transcode
        await this._APIService
          .send('START_TRANSCODE_FILE', {
            mediaId: result._id,
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

    return writeFileName(path);
  }
}
