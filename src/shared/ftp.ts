import Client, * as ftp from 'ftp';

function FTPException(message: string, code: number) {
  this.message = message;
  this.code = code;
  this.name = 'UserException';
}

export class FTP {
  fpt: Client = new ftp();

  constructor(host: string, port: number, user: string, password: string) {
    this.fpt.connect({ host, port, user, password, connTimeout: 5000 });
  }

  async createDir(nameFile: string) {
    return new Promise((resolve, reject) => {
      this.fpt.mkdir(nameFile, (e) => {
        if (e) {
          console.log(e);
          reject(new FTPException('Not create dir', 400));
        }
        resolve(true);
      });
    });
  }

  async cwd(path: string) {
    return new Promise((resolve, reject) => {
      this.fpt.cwd(path, (e) => {
        if (e) {
          console.log(e);
          reject(new FTPException('Not cwd dir', 401));
        }
        resolve(true);
      });
    });
  }

  async cdup() {
    return new Promise((resolve, reject) => {
      this.fpt.cdup((e) => {
        if (e) {
          console.log(e);
          reject(new FTPException('Not cdup dir', 402));
        }
        resolve(true);
      });
    });
  }

  async put(path: string, filename: string) {
    return new Promise((resolve, reject) => {
      this.fpt.put(path, filename, (e) => {
        if (e) {
          console.log(e);
          reject(new FTPException('Not put dir', 403));
        }
        resolve(true);
      });
    });
  }

  async remove(path: string) {
    return new Promise((resolve, reject) => {
      this.fpt.rmdir(path, true, (e) => {
        if (e) {
          reject(new FTPException('Not remove', 405));
        }
        resolve(true);
      });
    });
  }

  async list() {
    return new Promise((resolve, reject) => {
      this.fpt.list('/', (e, listing) => {
        if (e) {
          reject(new FTPException('Not list', 406));
        }
        console.log('listing', listing);
        resolve(true);
      });
    });
  }

  async connectFTP() {
    return new Promise((resolve, reject) => {
      this.fpt.on('ready', async () => {
        // await this.list();
        this.fpt.end();
        resolve(true);
      });
      this.fpt.on('error', (err) => {
        if (err) {
          console.log(err);
          reject(new FTPException('Not connect', 404));
        }
      });
    });
  }

  async uploadMedia(
    nameFile: string,
    nameMedia: string[],
    pathMedia: string[],
    xml?: string,
    pathThumb?: string | null,
    nameThumb?: string | null,
  ) {
    return new Promise((resolve, reject) => {
      this.fpt.on('ready', async () => {
        try {
          await this.createDir(nameFile);
          await this.cwd(nameFile);
          // MEDIA: START
          await this.createDir('media');
          await this.cwd('media');
          await Promise.all(
            pathMedia.map((path, key) => this.put(path, `${nameMedia[key]}`)),
          );
          await this.cdup();
          // MEDIA: END
          // THUMB: START
          if (nameThumb && pathThumb) {
            await this.createDir('thumb');
            await this.cwd('thumb');
            await this.put(pathThumb, nameThumb);
            await this.cdup();
          }
          // THUMB: END
          // METADATA: START
          await this.createDir('metadata');
          await this.cwd('metadata');
          await this.put(xml, 'metadata.xml');
          // METADATA: END
          this.fpt.end();
          resolve(true);
        } catch (error) {
          reject({ ...error, path: nameFile });
        }
      });
      this.fpt.on('error', (err) => {
        if (err) {
          console.log(err);
          reject(new FTPException('Not connect', 404));
        }
      });
    });
  }

  async updateMedia(nameFile: string, xml?: string, pathThumb?: string | null) {
    return new Promise((resolve, reject) => {
      this.fpt.on('ready', async () => {
        try {
          await this.cwd(nameFile);
          if (pathThumb) {
            await this.cwd('thumb');
            await this.put(pathThumb, 'thumb(update)');
            await this.cdup();
          }
          await this.cwd('metadata');
          await this.put(xml, 'metadata(update).xml');
          // METADATA: END
          this.fpt.end();
          resolve(true);
        } catch (error) {
          reject(error);
        }
      });
      this.fpt.on('error', (err) => {
        if (err) {
          console.log(err);
          reject(new FTPException('Not connect', 404));
        }
      });
    });
  }

  async removeMedia(nameFile: string) {
    return new Promise((resolve, reject) => {
      this.fpt.on('ready', async () => {
        try {
          await this.remove(nameFile);
          this.fpt.end();
          resolve(true);
        } catch (error) {
          reject(error);
        }
      });
      this.fpt.on('error', (err) => {
        if (err) {
          reject(new FTPException('Not connect', 404));
        }
      });
    });
  }
}
