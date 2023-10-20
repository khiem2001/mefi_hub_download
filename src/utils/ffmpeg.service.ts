import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

interface FileInfo {
  filename: string;
  fileSizeInBytes: number;
  fileSizeInKilobytes: number;
  fileSizeInMegabytes: number;
  mimeType: string;
  filenameWithoutExtension: string;
}

@Injectable()
export class FfmpegService {
  async getFileInfo(filePath: string): Promise<FileInfo | null> {
    try {
      const stats = fs.statSync(filePath);
      const fileSizeInBytes = stats.size;
      const fileSizeInKilobytes = fileSizeInBytes / 1024;
      const fileSizeInMegabytes = fileSizeInKilobytes / 1024;

      const mimeType = this.getMimeType(filePath);
      const filename = this.getFilename(filePath);
      const filenameWithoutExtension =
        this.getFilenameWithoutExtension(filePath);

      return {
        filename,
        fileSizeInBytes,
        fileSizeInKilobytes,
        fileSizeInMegabytes,
        mimeType,
        filenameWithoutExtension,
      };
    } catch (error) {
      return null;
    }
  }

  private getMimeType(filePath: string): string {
    const extname = path.extname(filePath).toLowerCase();
    // Map file extensions to MIME types as needed
    switch (extname) {
      case '.mp4':
        return 'video/mp4';
      case '.jpg':
        return 'image/jpeg';
      default:
        return 'application/octet-stream'; // Default MIME type
    }
  }

  private getFilename(filePath: string): string {
    const parts = filePath.split('/');
    return parts[parts.length - 1];
  }

  private getFilenameWithoutExtension(filePath: string): string {
    const filename = this.getFilename(filePath);
    const nameParts = filename.split('.');
    nameParts.pop(); // Remove the last part, which is the extension
    return nameParts.join('.'); // Join the remaining parts
  }
}
