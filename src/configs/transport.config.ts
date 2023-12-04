import { Transport } from '@nestjs/microservices';
import 'dotenv/config';

console.log('process.env.NATS_URL', process.env.NATS_URL);

const TRANSPORT_SERVICE = {
  API_SERVICE: {
    nats: {
      name: 'API_SERVICE',
      transport: Transport.NATS,
      options: {
        // url: process.env.API_NATS_URL || 'nats://localhost:4222',
        servers: [process.env.NATS_URL],
      },
    },
    redis: {
      name: 'API_SERVICE',
      transport: Transport.REDIS,
      options: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
      },
    },
  },
  TRANSCODE_SERVICE: {
    nats: {
      name: 'TRANSCODE_SERVICE',
      transport: Transport.NATS,
      options: {
        // url: process.env.TRANSCODE_NATS_URL || 'nats://localhost:4222',
        servers: [process.env.NATS_URL],
      },
    },
    redis: {
      name: 'TRANSCODE_SERVICE',
      transport: Transport.REDIS,
      options: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
      },
    },
  },
};

export { TRANSPORT_SERVICE };
