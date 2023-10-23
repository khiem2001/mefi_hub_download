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
      '/home/projects/mefi-hub-upload/storage',
      '/home/projects/mefi-hub-download/storage',
      'junction',
    );
  }
}
