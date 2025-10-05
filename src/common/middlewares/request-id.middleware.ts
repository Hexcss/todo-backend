import { v4 as uuid } from 'uuid';
import { Request, Response, NextFunction } from 'express';

export function requestIdMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = uuid();
  }
  next();
}
