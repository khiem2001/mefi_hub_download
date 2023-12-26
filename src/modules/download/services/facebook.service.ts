import { Injectable, Inject, Logger } from '@nestjs/common';
import { cookies } from 'configs/facebook.config';
import fs, { createWriteStream, existsSync, mkdirSync } from 'fs';
const puppeteer = require('puppeteer');
import axios from 'axios';
import pathToFfmpeg from 'ffmpeg-static';
import * as pathToFfprobe from 'ffprobe-static';
import * as Ffmpeg from 'fluent-ffmpeg';
import { PUB_SUB } from 'modules/subscription';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import * as path from 'path';

@Injectable()
export class FacebookService {
  private _ffmpeg: Ffmpeg.FfmpegCommand;

  constructor(@Inject(PUB_SUB) private _pubSub: RedisPubSub) {
    this._ffmpeg = Ffmpeg();
    this._ffmpeg.setFfmpegPath(pathToFfmpeg);
    this._ffmpeg.setFfprobePath(pathToFfprobe.path);
  }

  async getUrlMp4(url: string) {
    try {
      let videoInfo: any = null;
      let highestResolution = 0;
      let source = null;
      let pageContent = null;

      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-features=site-per-process'],
        protocolTimeout: 999999,
      });
      const page = await browser.newPage();

      // Truy cập trang Facebook Video URL
      await page.goto(url, {
        waitUntil: 'networkidle0',
      });

      pageContent = await page.content();
      const loginRegex = /<title id="pageTitle">Log in to Facebook<\/title>/;

      if (loginRegex.test(pageContent)) {
        await page.setCookie(...cookies);
        await page.goto(url, {
          waitUntil: 'networkidle0',
        });
        pageContent = await page.content();
      }

      const titleRegex = /<title>(.*)<\/title>/gm;
      const matchTitle = titleRegex.exec(pageContent);
      const name = matchTitle?.[1] ? matchTitle?.[1] : 'Video Facebook';

      //Get video url
      const regex =
        /all_video_dash_prefetch_representations":(.*),"is_final":/gm;
      const matchVideo = regex.exec(pageContent);

      if (matchVideo) {
        const videos = JSON.parse(matchVideo?.[1]);
        if (videos[0]?.representations?.length > 0) {
          //Get video info highestQuality
          for (const video of videos[0]?.representations) {
            const resolution = video.width * video.height;
            if (resolution > highestResolution) {
              highestResolution = resolution;
              videoInfo = video;
            }
          }
          //Get video url mp4
          source = videoInfo?.base_url;
        }
      }

      await browser.close();
      return { source, name };
    } catch (error) {
      throw new Error('Facebook url invalid!');
    }
  }
}
