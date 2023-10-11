import { Injectable } from '@nestjs/common';
import * as _ from 'lodash';

@Injectable()
export class ValidatorService {
  /**
   * Validate image file
   * @param mimeType
   */
  public isImage(mimeType: string): boolean {
    const imageMimeTypes = ['image/jpeg', 'image/png'];

    return _.includes(imageMimeTypes, mimeType);
  }

  /**
   * Validate video file
   * @param mimeType
   */
  public isVideo(mimeType: string): boolean {
    const videoMimeTypes = [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/x-msvideo',
      'video/x-matroska',
      'video/quicktime',
      'video/3gpp',
      'video/x-flv',
      'video/x-ms-wmv',
      'video/mpeg',
    ];

    return _.includes(videoMimeTypes, mimeType);
  }

  /**
   * Check file can transcode
   * @param mimeType
   */
  public canTranscode(mimeType: string): boolean {
    return this.isVideo(mimeType);
  }
}
