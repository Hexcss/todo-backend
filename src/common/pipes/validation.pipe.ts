import {
  ArgumentMetadata,
  Injectable,
  BadRequestException,
  ValidationPipe as NestValidationPipe,
} from '@nestjs/common';
import { AppLogger } from '../logger/logger.service';
import { ZodError } from 'zod';

@Injectable()
export class ValidationPipe extends NestValidationPipe {
  constructor(private readonly logger: AppLogger) {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  }

  async transform(
    value: unknown,
    metadata: ArgumentMetadata,
  ): Promise<unknown> {
    try {
      return await super.transform(value, metadata);
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.issues.map(
          (issue) => `${issue.path.join('.')}: ${issue.message}`,
        );

        this.logger.warn(
          `Validation failed: ${JSON.stringify(messages)}`,
          'ValidationPipe',
        );
        throw new BadRequestException(messages);
      }

      if (error instanceof Error) {
        this.logger.warn(
          `Validation failed: ${error.message}`,
          'ValidationPipe',
        );
        throw error;
      }

      // fallback for non-Error values
      this.logger.warn('Validation failed: Unknown error', 'ValidationPipe');
      throw new BadRequestException('Validation failed');
    }
  }
}
