import { Injectable } from '@nestjs/common';
import * as SftpClient from 'ssh2-sftp-client';
import { FTP_CONFIG } from 'configs/ftp.config';
import * as path from 'path';
import * as fs from 'fs';
import { existsSync, mkdirSync } from 'fs';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import { checkUsedFileName, getMimeByFileName, isVideoFile } from 'helpers/file';

@Injectable()
export class WatchFolderService {
  private readonly _watchFolder: string;

  constructor(private readonly _configService: ConfigService) {
    this._watchFolder = this._configService.get('WATCH_FOLDER_PATH');
  }

  async listDirectory(filePath: string) {
    const sftp = new SftpClient();

    try {
      await sftp.connect(FTP_CONFIG);

      const currentPath =
        filePath !== undefined
          ? `${this._watchFolder}/${filePath}`
          : this._watchFolder;

      return await this.recursiveList(sftp, currentPath);
    } catch (error) {
      return {
        success: true,
        data: [],
      };
    } finally {
      await sftp.end();
    }
  }

  async syncFileToStorage({ srcPath, organizationId }) {
    const sftp = new SftpClient();
    await sftp.connect(FTP_CONFIG);

    if (await this.isSftpFolder(sftp, `${this._watchFolder}/${srcPath}`)) {
      return {
        success: false,
        data: srcPath,
        message: 'This is folder not is file !',
      };
    }

    const storageDir = `${process.cwd()}/storage/${organizationId}`;

    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true });
    }

    const fileExtension = srcPath.split('.').pop();
    const prefix: string = uuid();

    const fileName = `${prefix}.${fileExtension}`;

    return new Promise(async (resolve, reject) => {
      try {
        await sftp.get(
          `${this._watchFolder}/${srcPath}`,
          fs.createWriteStream(`${storageDir}/${fileName}`),
        );
        resolve(`${organizationId}/${fileName}`);
      } catch (error) {
        await sftp.end();
        reject(error.message);
      }
    });
  }

  private async recursiveList(sftp: SftpClient, currentPath: string) {
    const list = await sftp.list(currentPath);
    const contents: any = [];

    for (const item of list) {
      const mime = getMimeByFileName(item.name)
      if (isVideoFile(mime) || item.type ==='d') {
      contents.push({
        name: item.name,
        size: item.size,
        isDirectory: item.type === 'd',
        mime,
        birthtime: item.accessTime,
        modifiedDate: item.modifyTime,
        requestPath: `${currentPath}/${item.name}`,
        used: checkUsedFileName(item.name)
      });
      }
    }

    return {
      success: true,
      data: contents,
    };
  }

  private async isSftpFile(sftp: SftpClient, path: string): Promise<boolean> {
    try {
      const fileStat = await sftp.stat(path);
      return fileStat.isFile;
    } catch (error) {
      return false;
    }
  }

  private async isSftpFolder(sftp: SftpClient, path: string): Promise<boolean> {
    try {
      const fileStat = await sftp.stat(path);
      return fileStat.isDirectory;
    } catch (error) {
      return false;
    }
  }

  private getFileNameFromPath(filePath: string) {
    return path.basename(filePath);
  }
}
