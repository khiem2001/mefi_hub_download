import * as path from 'path';
import { Request } from 'express';
import * as mime from 'mime-types';


export const getFileNameWithoutExtension = (file: string) => {
  const { name } = path.parse(file);
  return name;
};

export const extractFileNameFromPath = (filePath: string) => {
  return path.basename(filePath);
};

export const getMimeByFileName = (fileName : string) => {
  return mime.lookup(fileName) || '';
}

export const isVideoFile = (mime : string) => {
  return mime.startsWith("video/");
} 