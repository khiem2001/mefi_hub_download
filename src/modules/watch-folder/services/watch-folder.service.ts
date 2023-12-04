import { Injectable } from '@nestjs/common';
import * as SftpClient from 'ssh2-sftp-client';
import { FTP_CONFIG } from 'configs/ftp.config';
import * as fs from 'fs';
import { existsSync, mkdirSync } from 'fs';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import { checkUsedFileName, getMimeByFileName } from 'helpers/file';
import * as path from 'path';
import { promisify } from 'util';

@Injectable()
export class WatchFolderService {
  /**
   * Watch folder const
   * @private
   */
  private readonly _watchFolder: string;

  /**
   *
   * @param _configService
   */
  constructor(private readonly _configService: ConfigService) {
    this._watchFolder = this._configService.get('WATCH_FOLDER_PATH');
  }

  /**
   * RecursiveList file in watch folder
   * @param filePath
   * @param filterName
   */
  async listDirectory(filePath?: string, filterName?: string) {
    const sftp = new SftpClient();
    try {
      await sftp.connect(FTP_CONFIG);
      const currentPath =
        filePath !== undefined
          ? `${this._watchFolder}/${filePath}`
          : this._watchFolder;

      return await this.recursiveList(sftp, currentPath, filterName);
    } catch (error) {
      return {
        success: true,
        data: [],
      };
    } finally {
      await sftp.end();
    }
  }

  async readFolder(filePath?: string, filterName?: string) {
    const readdirAsync = promisify(fs.readdir);
    const statAsync = promisify(fs.stat);

    const currentPath =
      filePath !== undefined
        ? `${this._watchFolder}/${filePath}`
        : this._watchFolder;

    try {
      const files = await readdirAsync(currentPath);

      const contents: any = [];

      await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(currentPath, file);
          const stats = await statAsync(filePath);
          if (
            !filterName ||
            (filterName && new RegExp(`.*${filterName}.*`, 'i').test(file))
          ) {
            contents.push({
              name: file,
              size: stats.size,
              isDirectory: stats.isDirectory(),
              mime: getMimeByFileName(file),
              birthtime: stats.birthtimeMs,
              modifiedDate: stats.mtimeMs,
              requestPath: filePath,
            });
          }
        }),
      );
      return {
        success: true,
        data: contents,
      };
    } catch (error) {
      return {
        success: true,
        data: [],
      };
    }
  }

  async saveFileToFolder({ srcPath, organizationId }): Promise<string> {
    const storageDir = `${process.cwd()}/storage/${organizationId}`;
    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true });
    }
    const readStream = fs.createReadStream(srcPath);
    const fileExtension = srcPath.split('.').pop();
    const prefix: string = uuid();
    const fileName = `${prefix}.${fileExtension}`;
    const writeStream = fs.createWriteStream(`${storageDir}/${fileName}`);

    return new Promise((resolve, reject) => {
      readStream.pipe(writeStream);

      writeStream.on('finish', () => {
        resolve(`${organizationId}/${fileName}`);
      });

      writeStream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Sync file from watch folder to storage
   * @param srcPath
   * @param organizationId
   */
  async syncFileToStorage({ srcPath, organizationId }) {
    const sftp = new SftpClient();
    await sftp.connect(FTP_CONFIG);

    return new Promise(async (resolve, reject) => {
      try {
        const storageDir = `${process.cwd()}/storage/${organizationId}`;

        if (!existsSync(storageDir)) {
          mkdirSync(storageDir, { recursive: true });
        }

        const fileExtension = srcPath.split('.').pop();
        const prefix: string = uuid();

        const fileName = `${prefix}.${fileExtension}`;

        await sftp.get(
          `${srcPath}`,
          fs.createWriteStream(`${storageDir}/${fileName}`),
        );
        resolve(`${organizationId}/${fileName}`);
      } catch (error) {
        await sftp.end();
        reject(error);
      }
    });
  }

  /**
   * RecursiveList
   * @param sftp
   * @param currentPath
   * @param filterName
   * @private
   */
  private async recursiveList(
    sftp: SftpClient,
    currentPath: string,
    filterName?: string,
  ) {
    const list = await sftp.list(currentPath);
    const contents: any = [];
    for (const item of list) {
      const mime = getMimeByFileName(item.name);
      if (
        !filterName ||
        (filterName && new RegExp(`.*${filterName}.*`, 'i').test(item.name))
      ) {
        contents.push({
          name: item.name,
          size: item.size,
          isDirectory: item.type === 'd',
          mime,
          birthtime: item.accessTime,
          modifiedDate: item.modifyTime,
          requestPath: `${currentPath}/${item.name}`,
          used: checkUsedFileName(item.name),
        });
      }
    }

    return {
      success: true,
      data: contents,
    };
  }

  /**
   * Check is file
   * @param sftp
   * @param path
   * @private
   */
  private async isSftpFile(sftp: SftpClient, path: string): Promise<boolean> {
    try {
      const fileStat = await sftp.stat(path);
      return fileStat.isFile;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check is folder
   * @param sftp
   * @param path
   * @private
   */
  private async isSftpFolder(sftp: SftpClient, path: string): Promise<boolean> {
    try {
      const fileStat = await sftp.stat(path);
      return fileStat.isDirectory;
    } catch (error) {
      return false;
    }
  }
}
