import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import 'dotenv/config';
import { setupSwagger } from 'shared/swagger';
import { TRANSPORT_METHOD } from './configs';
import { AppModule } from './modules/app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = new ConfigService();
  const port = configService.get<number>('SERVER_PORT') || 5000;
  app.connectMicroservice(TRANSPORT_METHOD['redis']);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      dismissDefaultMessages: true,
      validationError: { target: false },
    }),
  );
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  await app.startAllMicroservices();
  setupSwagger(app);

  const server = await app.listen(port, () => {
    Logger.log(
      `[${new Date().toLocaleTimeString()}] Download server ready at http://localhost:${port} using FileStore`,
    );
  });
}
bootstrap();
