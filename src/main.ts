import { NestFactory } from '@nestjs/core';
import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { setupSwagger } from 'shared/swagger';
import { setupBullBoard } from './utils';
import { AppModule } from 'modules/app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = new ConfigService();
  const port = configService.get<number>('SERVER_PORT') || 5000;
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
  setupBullBoard(app);

  const server = await app.listen(port, () => {
    Logger.log(
      `[${new Date().toLocaleTimeString()}] Download server ready at http://localhost:${port}`,
    );
  });
}

bootstrap();
