import { Transport } from '@nestjs/microservices';

const TRANSPORT_SERVICE = {
  API_SERVICE: {
    nats: {
      name: 'API_SERVICE',
      transport: Transport.NATS,
      options: {
        url: process.env.API_NATS_URL || 'nats://localhost:4222',
      },
    },
    redis: {
      name: 'API_SERVICE',
      transport: Transport.REDIS,
      options: {
        host: process.env.API_REDIS_HOST || 'localhost',
        port: process.env.API_REDIS_PORT || 6379,
      },
    },
  },
  TRANSCODE_SERVICE: {
    nats: {
      name: 'TRANSCODE_SERVICE',
      transport: Transport.NATS,
      options: {
        url: process.env.TRANSCODE_NATS_URL || 'nats://localhost:4222',
      },
    },
    redis: {
      name: 'TRANSCODE_SERVICE',
      transport: Transport.REDIS,
      options: {
        host: process.env.TRANSCODE_REDIS_HOST || 'localhost',
        port: process.env.TRANSCODE_REDIS_PORT || 6379,
      },
    },
  },
};

export { TRANSPORT_SERVICE };
