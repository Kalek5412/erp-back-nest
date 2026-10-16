import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuración CORS universal para máxima compatibilidad
  app.enableCors({
    origin: [
      'http://localhost:4000',
      'http://localhost:4400',
      'http://192.168.1.68:4000',
      'http://192.168.1.68:4400',
      'http://ns1012130.indusquimica.pe:4400',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'empresa', 'X-Requested-With', 'Accept', 'X-XSRF-TOKEN'],
    credentials: true,
  });

  // Middleware adicional para manejar OPTIONS requests manualmente
  // Eliminado: el preflight lo maneja enableCors

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true, // Asegura que los payloads se transformen a instancias de DTO
      transformOptions: {
        enableImplicitConversion: true, // Permite la conversión de tipos primitivos
      },
    }),
  );

  const port = Number(process.env.PORT) || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();