import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'https://smart-report-extractor-frontend.vercel.app',
      'http://localhost:5173',
    ],
  });

  const port = parseInt(process.env.PORT || '3000', 10);



  await app.listen(port, '0.0.0.0');
}

bootstrap();
