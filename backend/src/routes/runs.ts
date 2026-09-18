import { listRunsQuerySchema, retryActionSchema, runIdSchema } from '@app/shared';
import { Router, type RequestHandler } from 'express';
import { parseOrThrow } from '../middleware/validate';
import type { RunService } from '../services/runService';

export function createRunsRouter(service: RunService, retryLimiter: RequestHandler): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const query = parseOrThrow(listRunsQuerySchema, req.query, 'query');
    const items = service.listRuns(query);
    res.json({ items, total: items.length });
  });

  router.get('/:id', (req, res) => {
    const id = parseOrThrow(runIdSchema, req.params.id, 'id');
    res.json({ run: service.getRun(id) });
  });

  router.post('/:id/retry', retryLimiter, (req, res) => {
    const id = parseOrThrow(runIdSchema, req.params.id, 'id');
    const action = parseOrThrow(retryActionSchema, req.body, 'body');
    const { run, replayed } = service.retryRun(id, action);
    res.status(202).set('Idempotent-Replayed', String(replayed)).json({ run });
  });

  return router;
}
