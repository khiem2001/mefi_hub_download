import * as path from 'path'

export const getFileNameWithoutExtension = (file: string) => {
    const { name } = path.parse(file);
    return name;
};

export const extractFileNameFromPath = (filePath: string) => {
    return path.basename(filePath);
};
