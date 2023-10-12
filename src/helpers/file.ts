import * as path from 'path';
import { Request } from 'express';

export const getFileNameWithoutExtension = (file: string) => {
  const { name } = path.parse(file);
  return name;
};

export const extractFileNameFromPath = (filePath: string) => {
  return path.basename(filePath);
};
