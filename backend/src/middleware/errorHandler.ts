import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../lib/errors';

type HttpError = Error & { status?: number; type?: string };

/** Errors raised by express.json() (malformed JSON, oversized body) carry a status and a type. */
function fromBodyParser(error: HttpError): AppError | undefined {
  if (error.type === 'entity.parse.failed') return new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON');
  if (error.type === 'entity.too.large') return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  return undefined;
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`));
};

/** Maps known errors to their status; everything else is logged and hidden behind a generic 500. */
export const errorHandler: ErrorRequestHandler = (error: HttpError, req, res, _next) => {
  const appError = error instanceof AppError ? error : fromBodyParser(error);
  if (appError) {
    res.status(appError.status).json({
      error: { code: appError.code, message: appError.message, details: appError.details },
    });
    return;
  }
  req.log.error({ err: error }, 'unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
};
