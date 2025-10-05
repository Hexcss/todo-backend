import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppLogger } from './common/logger/logger.service';
import { requestIdMiddleware } from './common/middlewares/request-id.middleware';
import { ValidationPipe } from './common/pipes/validation.pipe';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(AppLogger);
  app.useLogger(logger);

  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(cors());

  // Morgan access logs
  app.use(
    morgan('combined', {
      stream: {
        write: (message: string) => logger.log(message.trim(), 'HTTP'),
      },
    }),
  );

  // Global middleware
  app.useGlobalInterceptors(new LoggingInterceptor(logger));
  app.useGlobalFilters(new AllExceptionsFilter(logger));
  app.useGlobalPipes(new ValidationPipe(logger));

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('API Template')
    .setDescription('Reusable NestJS API template for microservices')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const docsDir = join(process.cwd(), 'docs');
  mkdirSync(docsDir, { recursive: true });

  const docsPath = join(docsDir, 'openapi.json');
  writeFileSync(docsPath, JSON.stringify(document, null, 2));
  logger.log(`Swagger JSON exported to ${docsPath}`, 'Bootstrap');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`Server running on http://localhost:${port}`, 'Bootstrap');
  logger.log(
    `Swagger docs available at http://localhost:${port}/docs`,
    'Bootstrap',
  );
}
void bootstrap();
