import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';

@Injectable()
export class FacebookService {
  async getVideoUrl(url: string) {
    try {
      const browser = await puppeteer.launch({
        headless: 'new',
      });
      const page = await browser.newPage();
      // Truy cập trang Facebook
      await page.goto(url);
      await page.waitForSelector('video', { timeout: 1000 });
      const videoUrl = await page.evaluate(() => {
        const videoElement = document.querySelector('video');
        return videoElement ? videoElement.src : null;
      });

      await browser.close();

      if (videoUrl) return { videoUrl };
      else throw new Error('Video URL not found.');
    } catch (error) {
      throw new Error('URL invalid!');
    }
  }
}
