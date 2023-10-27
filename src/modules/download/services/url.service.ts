import { createWriteStream } from 'fs';
import axios from 'axios';
import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';

@Injectable()
export class UrlService {
  async download(url: string, targetPath: string) {
    const fileExtension = url.split('.').pop();
    const prefix: string = uuid();

    const fileName = `${prefix}.${fileExtension}`;

    return new Promise(async (resolve, reject) => {
      try {
        const response = await axios({
          url,
          method: 'GET',
          responseType: 'stream',
        });

        const writer = createWriteStream(`${targetPath}/${fileName}`);

        response.data.pipe(writer);

        writer.on('finish', () => {
          console.log('Video downloaded successfully!');
          resolve(`${targetPath.replace(/^storage\//, '')}/${fileName}`);
        });

        writer.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}
