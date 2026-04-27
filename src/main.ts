import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// ✅ Load .env ONLY in local (not in Railway)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'https://smart-report-extractor-frontend.vercel.app',
      'http://localhost:5173',
    ],
  });

  const port = parseInt(process.env.PORT || '3000', 10);

  console.log('🚀 PORT:', port);
  console.log('🔑 GROQ KEY:', process.env.GROQ_API_KEY ? 'FOUND' : 'MISSING');

  await app.listen(port, '0.0.0.0');
}

bootstrap();
