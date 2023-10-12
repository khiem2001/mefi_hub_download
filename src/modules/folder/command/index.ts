import { Command } from 'nestjs-command';
import * as fs from 'fs';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CreateSymlinkStorageCommand {
    @Command({
        command: 'storage:link',
        describe: 'Create symlink to storage',
    })
    async createSymlinkStorage() {
        return fs.symlinkSync(
            'G:/Source/mefi-hub-download/storage',
            'G:/Source/mefi-hub-transcode/storage',
            'junction',
        );
    }
}
