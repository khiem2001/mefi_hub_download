import { OnQueueActive, OnQueueCompleted, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { FolderService } from '../folder.service';
import { Job } from 'bull';

@Processor('folder')
export class WatchFolderProcessor {
    constructor(private readonly _service: FolderService) { }

    @Process('download')
    @OnQueueActive()
    async downloadFile(job: Job) {
        const { url, folder, fileName } = job.data;
        return await this._service.downloadFromUrl(url, folder, fileName);
    }

    @OnQueueCompleted()
    async transcodePackage(job: Job) {
        try {
            const path = job.returnvalue
            const input = job.data.queueRequest
            const fileName = job.data.fileName
            await this._service.handlerTranscodePackage(path, input, fileName, job.data.url)

            return job.data.url
        } catch (error) {
            console.log(`Hanlder transcode or package video fail ! : ${error}`)
        }
    }

    @OnQueueFailed()
    async onFailed(job: Job, err: any) {
        console.log(`=> Fail download ${job.data.fileName}`);
    }
}