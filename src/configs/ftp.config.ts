import sftp from 'ssh2-sftp-client';

const FTP_CONFIG: sftp.ConnectOptions = {
  host: '42.96.40.158',
  port: 22,
  username: 'root',
  password: '34xoqVDbmy)',
};

export { FTP_CONFIG };
