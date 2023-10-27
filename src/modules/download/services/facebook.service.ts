import { Injectable } from '@nestjs/common';
const puppeteer = require('puppeteer');

@Injectable()
export class FacebookService {
  async getVideoUrl(url: string) {
    try {
      const browser = await puppeteer.launch({
        headless: true,
      });
      const page = await browser.newPage();
      // Truy cập trang Facebook
      await page.goto(url);

      // Wait for the video to load
      await page.waitForSelector('video', {
        timeout: 10000,
        waitUntil: 'load',
      });

      // Extract the video URL
      const videoUrl = await page.evaluate(() => {
        const videoElement = document.querySelector('video');
        return videoElement ? videoElement.src : null;
      });

      await browser.close();

      if (videoUrl) {
        return { videoUrl };
      } else {
        throw new Error('Video URL not found.');
      }
    } catch (error) {
      console.log(error);
      throw new Error('URL invalid!');
    }
  }
}
