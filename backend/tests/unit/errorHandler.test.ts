import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { errorHandler } from '../../src/middleware/errorHandler';
import { parseOrThrow } from '../../src/middleware/validate';

const mockResponse = () => {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
};

describe('errorHandler', () => {
  it('hides unexpected errors behind a generic 500 and logs them', () => {
    const req = { log: { error: vi.fn() } };
    const res = mockResponse();
    const error = new Error('db password is hunter2');

    errorHandler(error, req as unknown as Request, res as unknown as Response, vi.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    expect(req.log.error).toHaveBeenCalledWith({ err: error }, 'unhandled error');
  });
});

describe('parseOrThrow', () => {
  it('returns parsed data', () => {
    expect(parseOrThrow(z.number(), 1, 'value')).toBe(1);
  });

  it('uses the input name when an issue has no path', () => {
    expect(() => parseOrThrow(z.number(), 'x', 'value')).toThrow(
      expect.objectContaining({ status: 400, details: [expect.objectContaining({ path: 'value' })] }),
    );
  });
});
