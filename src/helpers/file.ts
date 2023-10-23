import * as mime from 'mime-types';

export const getMimeByFileName = (fileName : string) => {
  return mime.lookup(fileName) || '';
}

export const isVideoFile = (mime : string) => {
  return mime.startsWith("video/");
} 