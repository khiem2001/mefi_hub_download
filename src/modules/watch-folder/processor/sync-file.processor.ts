import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { WatchFolderService } from 'modules/watch-folder/services';

@Processor('sync')
export class SyncFileProcessor {
  constructor(private readonly _watchFolderService: WatchFolderService) {}

  @Process({
    name: 'syncToStorage',
    concurrency: 5,
  })
  async syncToStorage(job: Job) {
    const { organizationId, path } = job.data;
    return await this._watchFolderService.syncFileToStorage({
      srcPath: path,
      organizationId,
    });
  }
}
