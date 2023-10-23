import sftp from 'ssh2-sftp-client';

const FTP_CONFIG: sftp.ConnectOptions = {
  host: process.env.FTP_HOST,
  port: parseInt(process.env.FTP_PORT),
  username: process.env.FTP_USERNAME,
  password: process.env.FTP_PASSWORD,
};

export { FTP_CONFIG };
