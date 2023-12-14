import * as path from 'path';
import * as mime from 'mime-types';
import * as fs from 'fs';


export const getFileNameWithoutExtension = (file: string) => {
  const { name } = path.parse(file);
  return name;
};

export const extractFileNameFromPath = (filePath: string) => {
  return path.basename(filePath);
};

export const getMimeByFileName = (fileName: string) => {
  return mime.lookup(fileName) || '';
}

export const isVideoFile = (mime: string) => {
  return mime.startsWith("video/");
}

export const writeFileName = (name: string, organizationId: string) => {
  try {

    // Get the current date
    const currentDate = new Date();
    // Get year, month, and day
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1; // Months are zero-indexed, so we add 1
    const day = currentDate.getDate();
    const formattedDate = `${year}_${month}_${day}`;

    //create file and write file
    let fileName = `storage/${organizationId}/file_used_${formattedDate}.txt`
    if (fs.existsSync(fileName)) {
      // If the file already exists, append data to it on a new line
      fs.appendFileSync(fileName, '\n' + name, 'utf-8');
    } else {
      // If the file does not exist, create it and write data
      fs.writeFileSync(fileName, name, 'utf-8');
    }
  } catch (error) {
    throw new Error(`Error writing to file: ${error}`);
  }
}

export const checkUsedFileName = (name: string) => {
  let fileName = `src/helpers/fileNameDownload.txt`
  try {
    // Check if the file exists
    if (!fs.existsSync(fileName)) {
      return false;
    }
    // Use fs.readFileSync to read the file
    const data = fs.readFileSync(fileName, 'utf-8');
    const dataArray = data.split(`\n`);

    if (dataArray.includes(name)) {
      return true
    }

    return false
  } catch (error) {
    throw new Error(`Error reading file: ${error}`);
  }
}