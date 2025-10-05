import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';

type LogMessage = string | Record<string, unknown> | Error;

@Injectable()
export class AppLogger implements NestLoggerService {
  private defaultContext = 'App';
  private readonly service = process.env.K_SERVICE || 'local-service';
  private readonly revision = process.env.K_REVISION || 'local-revision';
  private readonly configuration =
    process.env.K_CONFIGURATION || 'local-config';
  private readonly isCloud =
    process.env.NODE_ENV === 'prod' || process.env.NODE_ENV === 'demo';

  log(message: LogMessage, context?: string, requestId?: string) {
    this.print('INFO', message, context, undefined, requestId);
  }

  error(
    message: LogMessage,
    trace?: string,
    context?: string,
    requestId?: string,
  ) {
    this.print('ERROR', message, context, trace, requestId);
  }

  warn(message: LogMessage, context?: string, requestId?: string) {
    this.print('WARNING', message, context, undefined, requestId);
  }

  debug(message: LogMessage, context?: string, requestId?: string) {
    this.print('DEBUG', message, context, undefined, requestId);
  }

  verbose(message: LogMessage, context?: string, requestId?: string) {
    this.print('DEBUG', message, context, undefined, requestId); // GCP doesn’t have VERBOSE
  }

  private print(
    severity: string,
    message: LogMessage,
    context?: string,
    trace?: string,
    requestId?: string,
  ) {
    let formattedMessage: string;
    let stack: string | undefined;
    let extra: Record<string, unknown> | undefined;

    if (typeof message === 'string') {
      formattedMessage = message;
    } else if (message instanceof Error) {
      formattedMessage = message.message;
      stack = message.stack;
    } else {
      formattedMessage = JSON.stringify(message);
      extra = message;
    }

    const payload = {
      severity,
      message: formattedMessage,
      context: context || this.defaultContext,
      timestamp: new Date().toISOString(),
      trace,
      requestId,
      labels: {
        serviceContext: context || this.defaultContext,
        runtime: {
          service: this.service,
          revision: this.revision,
          configuration: this.configuration,
        },
      },
      ...(extra ? { extra } : {}),
    };

    if (this.isCloud) {
      process.stdout.write(JSON.stringify(payload) + '\n');
    } else {
      // Pretty print for dev
      const color = this.getColor(severity);
      const output = [
        `${color}${severity.padEnd(7)}\x1b[0m`,
        `[${payload.timestamp}]`,
        `[${payload.context}]`,
        `(${payload.requestId || 'no-reqid'})`,
        `→ ${payload.message}`,
      ].join(' ');

      process.stdout.write(output + '\n');

      if (trace) {
        process.stdout.write(`   \x1b[90m${trace}\x1b[0m\n`);
      }

      if (stack) {
        process.stdout.write(`   \x1b[90m${stack}\x1b[0m\n`);
      }
    }
  }

  private getColor(severity: string): string {
    switch (severity) {
      case 'ERROR':
        return '\x1b[31m';
      case 'WARNING':
        return '\x1b[33m';
      case 'INFO':
        return '\x1b[36m';
      case 'DEBUG':
        return '\x1b[35m';
      default:
        return '\x1b[0m';
    }
  }
}
