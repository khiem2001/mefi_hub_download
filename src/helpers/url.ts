import * as puppeteer from 'puppeteer';
import * as ytdl from 'ytdl-core';
import * as path from 'path';
import * as urlPath from 'url';
import { SocialSource } from 'shared/enum';
import { v4 as uuid } from 'uuid';
import { existsSync, mkdirSync } from 'fs';

export const IsUrl = (url: string) => {
  const regex =
    /[(http(s)?):\/\/(www\.)?a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/;

  return regex.test(url);
};

export const IsFacebookUrl = (url: string) => {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(mbasic.facebook|m\.facebook|facebook|fb)\.(com|me)\/(?:(?:\w\.)*#!\/)?(?:pages\/)?(?:[\w\-\.]*\/)*([\w\-\.]*)/;

  return regex.test(url);
};

export const IsYoutubeUrl = (url: string) => {
  const regex =
    /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/;

  return regex.test(url);
};

export const IsMp4Url = (url: string) => {
  const regex = /https?.*?\.mp4/;

  return regex.test(url);
};

export const FacebookGetInfoVideo = async (url: string) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    ignoreDefaultArgs: ['--disable-extensions'],
  });

  const cookie =
    '[{"name":"xs","value":"48%3A1nChz5HZ3bFZRA%3A2%3A1611687721%3A7854%3A10334","domain":".facebook.com","path":"/","expires":1643223720.883315,"size":53,"httpOnly":true,"secure":true,"session":false,"sameSite":"None"},{"name":"c_user","value":"100058688485666","domain":".facebook.com","path":"/","expires":1643223720.883293,"size":21,"httpOnly":false,"secure":true,"session":false,"sameSite":"None"},{"name":"wd","value":"358x812","domain":".facebook.com","path":"/","expires":1612292527,"size":9,"httpOnly":false,"secure":true,"session":false,"sameSite":"Lax"},{"name":"m_pixel_ratio","value":"1","domain":".facebook.com","path":"/","expires":-1,"size":14,"httpOnly":false,"secure":true,"session":true},{"name":"fr","value":"1XocO6bnIKS9i42dx.AWUcypOju4_74m6Ornir-ShJJts.BgEGcl.17.AAA.0.0.BgEGcp.AWW3zUv055A","domain":".facebook.com","path":"/","expires":1619463718.883213,"size":84,"httpOnly":true,"secure":true,"session":false,"sameSite":"None"},{"name":"sb","value":"JWcQYE8YEMGuqQ-1PbMdsBbn","domain":".facebook.com","path":"/","expires":1674759722.88327,"size":26,"httpOnly":true,"secure":true,"session":false,"sameSite":"None"},{"name":"datr","value":"JWcQYEK5fpgPVRQ5eUQbtf-Q","domain":".facebook.com","path":"/","expires":1674759717.584945,"size":28,"httpOnly":true,"secure":true,"session":false,"sameSite":"None"}]';
  const page = await browser.newPage();
  await page.setCookie(...JSON.parse(cookie));

  try {
    await page.goto(url);

    const title = await page.$eval(
      "head > meta[property='og:title']",
      (element: HTMLMetaElement) => element.content,
    );

    return { title };
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    await browser.close();
  }
};

export const YoutubeGetInfoVideo = async (url: string) => {
  try {
    const info = await ytdl.getInfo(url);
    return { title: info.videoDetails.title };
  } catch (error) {
    console.error('An error occurred:', error);
  }
};

export const detectUrl = (url): SocialSource => {
  if (IsFacebookUrl(url)) return SocialSource.FACEBOOK;
  else if (IsYoutubeUrl(url)) return SocialSource.YOUTUBE;
  else if (IsMp4Url(url)) return SocialSource.MP4;
  else return SocialSource.OTHER;
};

export const GetInfoFromUrl = async (url: string) => {
  const type = detectUrl(url);
  let title: string;

  switch (type) {
    case SocialSource.FACEBOOK:
      try {
        const data = await FacebookGetInfoVideo(url);
        title = data.title;
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

export const genPathMp4 = (organizationId: string) => {
  const uploadPath = process.env.FILE_STORAGE_PATH + '/' + organizationId;
  if (!existsSync(uploadPath)) {
    mkdirSync(uploadPath, { recursive: true });
  }
  return uploadPath + '/' + uuid() + '.mp4';
};
