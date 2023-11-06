import * as fs from 'fs';
import axios from 'axios';
import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import * as pathToFfmpeg from 'ffmpeg-static';
import * as pathToFfprobe from 'ffprobe-static';
import * as Ffmpeg from 'fluent-ffmpeg';
import { PUB_SUB } from 'modules/subscription';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { html } from 'cheerio/lib/api/manipulation';
import { resolve } from 'path';
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

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
        headless: false,
        args: ['--no-sandbox', '--disable-features=site-per-process'],
        protocolTimeout: 999999,
      });
      const page = await browser.newPage();

      // Truy cập trang Facebook
      await page.goto(url, {
        waitUntil: 'networkidle0',
      });

      let pageContent = await page.content();
      const $ = cheerio.load(pageContent);

      const videoElement = $('video').first();
      const videoSrc = videoElement.attr('src');
      const pElement = $('p').first();
      const pContent = pElement.text();

      const regex =
        /all_video_dash_prefetch_representations":\[{"representations":(.*),"video_id":/gm;

      const videos = JSON.parse(regex.exec(pageContent)?.[1]);

      console.log(videos);

      await new Promise((resolve) => setTimeout(resolve, 500000));
      // await browser.close();
      if (!videoSrc) throw new Error('Video URL not found.');

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
        this._ffmpeg.input(videoSrc).ffprobe((err, metadata) => {
          if (err) {
            reject(err);
          } else {
            const format = metadata.format;
            resolve({
              source: videoSrc,
              name: pContent || 'Video Facebook',
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
