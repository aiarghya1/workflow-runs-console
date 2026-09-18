export type ErrorDetail = { path: string; message: string };

/** An error that is safe to expose to API clients. Anything else becomes a generic 500. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (message: string) => new AppError(404, 'NOT_FOUND', message);

export const conflict = (code: string, message: string) => new AppError(409, code, message);

export const badRequest = (message: string, details?: ErrorDetail[]) =>
  new AppError(400, 'VALIDATION_ERROR', message, details);
