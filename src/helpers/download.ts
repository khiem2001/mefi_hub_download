import {
  FacebookGetInfoVideo,
  IsMp4Url,
  IsUrl,
  IsYoutubeUrl,
  YoutubeGetInfoVideo,
  IsFacebookUrl,
} from './url';
import * as path from 'path';
import * as urlPath from 'url';
import { v4 as uuid } from 'uuid';
import { existsSync, mkdirSync, createWriteStream } from 'fs';
import * as cp from 'child_process';
import * as readline from 'readline';
import * as ytdl from 'ytdl-core';
import axios from 'axios';
import * as puppeteer from 'puppeteer';
import { SocialSource } from 'shared/enum';

export const genPathMp4 = () => {
  // const currentDate = dateFormat(new Date(), '%Y/%m/%d', true);
  const uploadPath = process.env.FILE_STORAGE_PATH + '/';
  //  + currentDate;
  if (!existsSync(uploadPath)) {
    mkdirSync(uploadPath, { recursive: true });
  }
  return uploadPath + '/' + uuid() + '.mp4';
};

export const detectUrl = (url): SocialSource => {
  if (IsUrl(url)) {
    let type;
    if (IsFacebookUrl(url)) {
      type = SocialSource.FACEBOOK;
    } else if (IsYoutubeUrl(url)) {
      type = SocialSource.YOUTUBE;
    } else if (IsMp4Url(url)) {
      type = SocialSource.MP4;
    } else {
      type = SocialSource.OTHER;
    }
    return type;
  } else throw new Error('Invalid URL');
};

export const GetInfoFromUrl = async (url: string) => {
  const type = detectUrl(url);
  let title: string;

  switch (type) {
    case SocialSource.FACEBOOK:
      try {
        // const data = await FacebookGetInfoVideo(url);
        // title = data.title;
        title = 'sdsds';
      } catch (error) {
        title = 'Upload from facebook';
      }
      break;

    case SocialSource.YOUTUBE:
      try {
        const data = await YoutubeGetInfoVideo(url);
        title = data.title;
      } catch {
        title = 'Upload from youtube';
      }
      break;
    case SocialSource.MP4:
      try {
        const parsed = urlPath.parse(url);
        title = path
          .basename(parsed.pathname)
          .split('.')
          .slice(0, -1)
          .join('.');
      } catch {
        title = 'Upload from mp4';
      }
      break;
    default:
      let parsed = urlPath.parse(url);
      title = path.basename(parsed.pathname).split('.').slice(0, -1).join('.');
  }

  return {
    title,
    type,
  };
};

export const downloadFromYoutube = (url: string) => {
  const path = genPathMp4();
  const ffmpeg = require('ffmpeg-static');
  const tracker = {
    start: Date.now(),
    audio: { downloaded: 0, total: Infinity },
    video: { downloaded: 0, total: Infinity },
    merged: { frame: 0, speed: '0x', fps: 0 },
  };

  // Get audio and video streams
  const audio = ytdl(url, { quality: 'highestaudio' }).on(
    'progress',
    (_, downloaded, total) => {
      tracker.audio = { downloaded, total };
    },
  );
  const video = ytdl(url, { quality: 'highestvideo' }).on(
    'progress',
    (_, downloaded, total) => {
      tracker.video = { downloaded, total };
    },
  );

  // Prepare the progress bar
  let progressbarHandle = null;
  const progressbarInterval = 1000;
  const showProgress = () => {
    readline.cursorTo(process.stdout, 0);
    const toMB = (i) => (i / 1024 / 1024).toFixed(2);

    process.stdout.write(
      `Audio  | ${(
        (tracker.audio.downloaded / tracker.audio.total) *
        100
      ).toFixed(2)}% processed `,
    );
    process.stdout.write(
      `(${toMB(tracker.audio.downloaded)}MB of ${toMB(
        tracker.audio.total,
      )}MB).${' '.repeat(10)}\n`,
    );

    process.stdout.write(
      `Video  | ${(
        (tracker.video.downloaded / tracker.video.total) *
        100
      ).toFixed(2)}% processed `,
    );
    process.stdout.write(
      `(${toMB(tracker.video.downloaded)}MB of ${toMB(
        tracker.video.total,
      )}MB).${' '.repeat(10)}\n`,
    );

    process.stdout.write(`Merged | processing frame ${tracker.merged.frame} `);
    process.stdout.write(
      `(at ${tracker.merged.fps} fps => ${tracker.merged.speed}).${' '.repeat(
        10,
      )}\n`,
    );

    process.stdout.write(
      `running for: ${((Date.now() - tracker.start) / 1000 / 60).toFixed(
        2,
      )} Minutes.`,
    );
    readline.moveCursor(process.stdout, 0, -3);
  };
  // Start the ffmpeg child process
  const ffmpegProcess: any = cp.spawn(
    ffmpeg,
    [
      // Remove ffmpeg's console spamming
      '-loglevel',
      '8',
      '-hide_banner',
      // Redirect/Enable progress messages
      '-progress',
      'pipe:3',
      // Set inputs
      '-i',
      'pipe:4',
      '-i',
      'pipe:5',
      // Map audio & video from streams
      '-map',
      '0:a',
      '-map',
      '1:v',
      // Keep encoding
      '-c:v',
      'copy',
      // Define output file
      `${path}`,
    ],
    {
      windowsHide: true,
      stdio: [
        /* Standard: stdin, stdout, stderr */
        'inherit',
        'inherit',
        'inherit',
        /* Custom: pipe:3, pipe:4, pipe:5 */
        'pipe',
        'pipe',
        'pipe',
      ],
    },
  );
  ffmpegProcess.on('close', () => {
    console.log('done ');
    // Cleanup
    process.stdout.write('\n\n\n\n');
    clearInterval(progressbarHandle);
  });

  // Link streams
  // FFmpeg creates the transformer streams and we just have to insert / read data
  ffmpegProcess.stdio[3].on('data', (chunk) => {
    // Start the progress bar
    if (!progressbarHandle)
      progressbarHandle = setInterval(showProgress, progressbarInterval);
    // Parse the param=value list returned by ffmpeg
    const lines = chunk.toString().trim().split('\n');
    const args: any = {};
    for (const l of lines) {
      const [key, value] = l.split('=');
      args[key.trim()] = value.trim();
    }
    tracker.merged = args;
  });

  audio.pipe(ffmpegProcess.stdio[4]);
  video.pipe(ffmpegProcess.stdio[5]);
  video.on('finish', () => {
    console.log('=>>Finished video');
  });
  audio.on('finish', () => {
    console.log('=>>Finished audio');
  });
  return new Promise((resolve, reject) => {
    // video.on('finish', resolve);
    // audio.on('finish', resolve);
    video.on('error', reject);
    audio.on('error', reject);
    ffmpegProcess.on('close', resolve);
  });
};

export const downloadFromUrl = async (url: string) => {
  const path = genPathMp4();

  axios({
    url,
    method: 'GET',
    responseType: 'stream',
  })
    .then((response) => {
      const writer = createWriteStream(path);

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    })
    .then(() => {
      console.log('Video downloaded successfully!');
    })
    .catch((error) => {
      throw new Error('URL invalid!');
    });
};

export const downloadFromFacebook = async (url) => {
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
    });
    const page = await browser.newPage();
    // Truy cập trang Facebook
    await page.goto(url);
    await page.waitForSelector('video', { timeout: 5000 });
    const videoUrl = await page.evaluate(() => {
      const videoElement = document.querySelector('video');
      return videoElement ? videoElement.src : null;
    });
    await browser.close();
    if (videoUrl) downloadFromUrl(videoUrl);
    else throw new Error('Video URL not found.');
  } catch (error) {
    throw new Error('URL invalid!');
  }
};
