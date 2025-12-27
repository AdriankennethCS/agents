import { Router, Request, Response } from 'express';
import { DecisionStore } from '../stores/DecisionStore';
import { AgentIdParamSchema, DecisionsQuerySchema } from './validation';
import { z } from 'zod';

export function createDecisionsRouter(): Router {
  const router = Router();
  const decisionStore = DecisionStore.getInstance();

  router.get('/:id', (req: Request, res: Response) => {
    try {
      const { id } = AgentIdParamSchema.parse({ id: req.params.id });
      const query = DecisionsQuerySchema.parse(req.query);

      const result = decisionStore.queryDecisions(
        id,
        query.from,
        query.to,
        { limit: query.limit, offset: query.offset }
      );

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request', details: error.errors });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

