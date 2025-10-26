import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppLogger } from '../logger/logger.service';

type AnyError = unknown & {
  code?: string | number;
  message?: string;
  details?: string;
  status?: number;
  response?: any;
};

const grpcToHttp = (code: number): number => {
  switch (code) {
    case 3:
      return HttpStatus.BAD_REQUEST; // INVALID_ARGUMENT
    case 4:
      return HttpStatus.GATEWAY_TIMEOUT; // DEADLINE_EXCEEDED
    case 5:
      return HttpStatus.NOT_FOUND; // NOT_FOUND
    case 6:
      return HttpStatus.CONFLICT; // ALREADY_EXISTS
    case 7:
      return HttpStatus.FORBIDDEN; // PERMISSION_DENIED
    case 8:
      return HttpStatus.TOO_MANY_REQUESTS; // RESOURCE_EXHAUSTED
    case 9:
      return HttpStatus.BAD_REQUEST; // FAILED_PRECONDITION
    case 10:
      return HttpStatus.CONFLICT; // ABORTED
    case 11:
      return HttpStatus.PRECONDITION_FAILED; // OUT_OF_RANGE (best-effort)
    case 12:
      return HttpStatus.NOT_IMPLEMENTED; // UNIMPLEMENTED
    case 13:
      return HttpStatus.INTERNAL_SERVER_ERROR; // INTERNAL
    case 14:
      return HttpStatus.SERVICE_UNAVAILABLE; // UNAVAILABLE
    case 15:
      return HttpStatus.SERVICE_UNAVAILABLE; // DATA_LOSS (best-effort)
    case 16:
      return HttpStatus.UNAUTHORIZED; // UNAUTHENTICATED
    default:
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
};

const firebaseAuthToHttp = (code: string): number => {
  switch (code) {
    case 'auth/email-already-exists':
    case 'auth/uid-already-exists':
      return HttpStatus.CONFLICT;
    case 'auth/user-not-found':
      return HttpStatus.NOT_FOUND;
    case 'auth/user-disabled':
    case 'auth/operation-not-allowed':
    case 'auth/insufficient-permission':
      return HttpStatus.FORBIDDEN;
    case 'auth/id-token-expired':
    case 'auth/session-cookie-revoked':
    case 'auth/invalid-id-token':
    case 'auth/unauthorized-continue-uri':
      return HttpStatus.UNAUTHORIZED;
    case 'auth/invalid-password':
    case 'auth/invalid-email':
    case 'auth/argument-error':
    case 'auth/missing-email':
    case 'auth/missing-password':
      return HttpStatus.BAD_REQUEST;
    case 'auth/too-many-requests':
      return HttpStatus.TOO_MANY_REQUESTS;
    default:
      return HttpStatus.BAD_REQUEST;
  }
};

const identityRestToHttp = (msg: string): number => {
  switch (msg) {
    case 'EMAIL_EXISTS':
      return HttpStatus.CONFLICT;
    case 'OPERATION_NOT_ALLOWED':
    case 'USER_DISABLED':
      return HttpStatus.FORBIDDEN;
    case 'EMAIL_NOT_FOUND':
      return HttpStatus.NOT_FOUND;
    case 'INVALID_PASSWORD':
    case 'WEAK_PASSWORD':
    case 'MISSING_PASSWORD':
    case 'INVALID_EMAIL':
      return HttpStatus.BAD_REQUEST;
    case 'TOO_MANY_ATTEMPTS_TRY_LATER':
      return HttpStatus.TOO_MANY_REQUESTS;
    case 'INVALID_REFRESH_TOKEN':
    case 'TOKEN_EXPIRED':
      return HttpStatus.UNAUTHORIZED;
    default:
      return HttpStatus.BAD_REQUEST;
  }
};

const normalizeMessages = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((x) => typeof x === 'string') as string[];
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object' && 'message' in (value as any)) {
    const m = (value as any).message;
    if (Array.isArray(m)) return m.filter((x: any) => typeof x === 'string');
    if (typeof m === 'string') return [m];
  }
  return [];
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let messages: string[] = ['Internal server error'];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      const msg = normalizeMessages(body);
      if (msg.length) messages = msg;
      else if (exception.message) messages = [exception.message];
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      messages = exception.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    } else if (typeof exception === 'object' && exception !== null) {
      const e = exception as AnyError;

      if (typeof e.status === 'number') {
        status = e.status;
      }

      if (typeof e.code === 'number') {
        status = grpcToHttp(e.code);
      } else if (typeof e.code === 'string' && e.code.startsWith('auth/')) {
        status = firebaseAuthToHttp(e.code);
      } else if (e.response && typeof e.response === 'object') {
        const err = e.response.error || e.response;
        const msgCode: string | undefined =
          (err?.message && typeof err.message === 'string' ? err.message : undefined) ||
          (Array.isArray(err?.errors) && err.errors[0]?.message ? err.errors[0].message : undefined);
        if (msgCode) status = identityRestToHttp(msgCode);
      }

      const collected: string[] = [];
      if (typeof e.message === 'string' && e.message.trim()) collected.push(e.message);
      if (typeof e.details === 'string' && e.details.trim() && e.details !== e.message) collected.push(e.details);
      if (e.response) {
        const fromResp = normalizeMessages(e.response);
        collected.push(...fromResp);
        const nested = normalizeMessages(e.response?.error);
        collected.push(...nested);
      }
      if (collected.length) messages = Array.from(new Set(collected));
    } else if (exception instanceof Error) {
      messages = [exception.message];
    }

    this.logger.error(
      {
        event: 'exception',
        status,
        messages,
        path: req.url,
        method: req.method,
        requestId: (req.headers['x-request-id'] as string) || undefined,
        stack: exception instanceof Error ? exception.stack : undefined,
      },
      exception instanceof Error ? exception.stack : undefined,
      'ExceptionFilter',
    );

    res.status(status).json({
      statusCode: status,
      errors: messages,
      path: req.url,
      timestamp: new Date().toISOString(),
      requestId: (req.headers['x-request-id'] as string) || undefined,
    });
  }
}
