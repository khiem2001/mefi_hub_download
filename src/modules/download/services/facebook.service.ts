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
      this._ffmpeg = Ffmpeg();

      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-features=site-per-process'],
        protocolTimeout: 999999,
      });
      const page = await browser.newPage();

      // Truy cập trang Facebook
      await page.goto(url, {
        waitUntil: 'networkidle0',
      });

      let pageContent = await page.content();

      const videoSrc = url;

      const regex =
        /all_video_dash_prefetch_representations":\[{"representations":(.*),"video_id":/gm;
      // "https://www.facebook.com/VieComedyDatVietVAC/videos/6643796835733461"
      const videos = JSON.parse(regex.exec(pageContent)?.[1]);

      let videoInfo: any = null;
      let highestResolution = 0;
      for (const video of videos) {
        const resolution = video.width * video.height;
        if (resolution > highestResolution) {
          highestResolution = resolution;
          videoInfo = video;
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
        this._ffmpeg.input(videoInfo?.base_url).ffprobe((err, metadata) => {
          if (err) {
            reject(err);
          } else {
            console.log(metadata);
            const format = metadata.format;
            resolve({
              source: videoInfo?.base_url,
              name: 'Video Facebook',
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
