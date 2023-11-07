import * as fs from 'fs';
import axios from 'axios';
import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import * as pathToFfmpeg from 'ffmpeg-static';
import * as pathToFfprobe from 'ffprobe-static';
import * as Ffmpeg from 'fluent-ffmpeg';
import { PUB_SUB } from 'modules/subscription';
import { RedisPubSub } from 'graphql-redis-subscriptions';
const puppeteer = require('puppeteer');
@Injectable()
export class FacebookService {
  private _ffmpeg: Ffmpeg.FfmpegCommand;

  constructor(@Inject(PUB_SUB) private _pubSub: RedisPubSub) {
    this._ffmpeg = Ffmpeg();
    this._ffmpeg.setFfmpegPath(pathToFfmpeg);
    this._ffmpeg.setFfprobePath(pathToFfprobe.path);
  }

  async getFacebookVideoMetadata(url: string) {
    try {
      //init variable
      this._ffmpeg = Ffmpeg();
      let videoInfo: any = null;
      let highestResolution = 0;
      let source = null;

      //puppeteer
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-features=site-per-process'],
        protocolTimeout: 999999,
      });
      const page = await browser.newPage();

      // Truy cập trang Facebook
      await page.goto(url, {
        waitUntil: 'networkidle0',
      });

      //Get title video
      const ogTitle = await page.$eval(
        'meta[property="og:title"]',
        (element) => {
          return element.getAttribute('content');
        },
      );

      //Get video url
      const pageContent = await page.content();
      const regex =
        /all_video_dash_prefetch_representations":(.*),"is_final":/gm;
      const match = regex.exec(pageContent);

      if (match) {
        const videos = JSON.parse(match?.[1]);
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
      return new Promise<{
        source;
        name: string;
        durationInSeconds: number;
        frameSize: {
          width: number;
          height: number;
        };
        mimeType: string;
      }>((resolve, reject) => {
        this._ffmpeg.input(source).ffprobe((err, metadata) => {
          if (err) {
            reject(err);
          } else {
            const format = metadata.format;
            resolve({
              source,
              name: ogTitle?.substring(0, 200) || 'Video Facebook',
              mimeType: format.format_name,
              durationInSeconds: format.duration,
              frameSize: {
                width: metadata.streams[0].width,
                height: metadata.streams[0].height,
              },
            });
          }
        });
      });
    } catch (error) {
      console.log(error);
      throw new Error('URL invalid!');
    }
  }
}
