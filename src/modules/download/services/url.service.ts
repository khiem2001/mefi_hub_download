import { createWriteStream } from 'fs';
import axios from 'axios';
import { Injectable } from '@nestjs/common';
@Injectable()
export class UrlService {
  constructor() {}

  async download(url: string, path: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await axios({
          url,
          method: 'GET',
          responseType: 'stream',
        });

        const writer = createWriteStream(path);

        response.data.pipe(writer);

        writer.on('finish', () => {
          console.log('Video downloaded successfully!');
          resolve();
        });

        writer.on('error', (error) => {
          reject(new Error('Failed to save the video file'));
        });
      } catch (error) {
        reject(new Error('URL invalid!'));
      }
    });
  }
}
