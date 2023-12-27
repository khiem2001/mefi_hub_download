import { Injectable, Inject } from '@nestjs/common';
import { cookies } from 'configs/facebook.config';
import { existsSync, mkdirSync } from 'fs';
const puppeteer = require('puppeteer');
import * as Ffmpeg from 'fluent-ffmpeg';
import { PUB_SUB } from 'modules/subscription';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import * as path from 'path';
import { UrlService } from './url.service';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';

@Injectable()
export class FacebookService {
  private _ffmpeg: Ffmpeg.FfmpegCommand;

  constructor(
    @Inject(PUB_SUB) private _pubSub: RedisPubSub,
    private readonly _urlService: UrlService,
    private readonly _configService: ConfigService,
  ) {
    this._ffmpeg = Ffmpeg();
    this._ffmpeg.setFfmpegPath(this._configService.get('FFMPEG_BIN_PATH'));
    this._ffmpeg.setFfprobePath(this._configService.get('FFPROBE_BIN_PATH'));
  }

  async downloadVideo({ url, organizationId }) {
    const { sourceVideo, sourceAudio, name, videoId } = await this.getInfo(url);

    const storageDir = `storage/${organizationId}`;
    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true });
    }

    const fileNameAudio = path.basename(sourceAudio);

    const indexAudio = fileNameAudio.indexOf('.mp4');
    const fileNameAudioCustom = fileNameAudio.substring(0, indexAudio) + '.mp3';

    const { filePath: filePathVideo }: any =
      await this._urlService.downloadVideo({
        url: sourceAudio,
        organizationId,
        fileNameCustom: fileNameAudioCustom,
      });

    const fileNameVideo = path.basename(sourceVideo);
    const indexVideo = fileNameVideo.indexOf('.mp4');
    const fileNameVideoCustom = fileNameVideo.substring(0, indexVideo + 4);

    const { filePath: filePathAudio }: any =
      await this._urlService.downloadVideo({
        url: sourceVideo,
        organizationId,
        fileNameCustom: fileNameVideoCustom,
      });

    const filePath = await this.mergeVideoAndAudio(
      filePathVideo,
      filePathAudio,
      `${organizationId}/${videoId || uuid()}.mp4`,
    );

    return {
      filePath,
      name,
    };
  }

  async getInfo(url: string) {
    try {
      let videoInfo: any = null;
      let audioInfo = null;
      let highestResolution = 0;
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
            if (video.mime_type === 'video/mp4') {
              const resolution = video.width * video.height;
              if (resolution > highestResolution) {
                highestResolution = resolution;
                videoInfo = video;
              }
            }
            if (video.mime_type === 'audio/mp4') {
              audioInfo = video;
            }
          }
          //Get url
          const sourceVideo = videoInfo?.base_url;
          const sourceAudio = audioInfo?.base_url;

          return {
            sourceVideo,
            sourceAudio,
            name,
            videoId: videos[0]?.video_id,
          };
        }
      }
      await browser.close();
      throw new Error('Facebook url invalid!');
    } catch (error) {
      throw new Error('Facebook url invalid!');
    }
  }

  async mergeVideoAndAudio(
    videoPath: string,
    audioPath: string,
    outputPath: string,
  ) {
    return new Promise((resolve, reject) => {
      this._ffmpeg
        .input(`storage/${videoPath}`)
        .input(`storage/${audioPath}`)
        .videoCodec('copy')
        .audioCodec('aac')
        .save(`storage/${outputPath}`)
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(err));
    });
  }
}
