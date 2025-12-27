import { Router, Request, Response } from 'express';
import { DecisionStore } from '../stores/DecisionStore';
import { AgentIdParamSchema } from './validation';
import { z } from 'zod';

export function createReplayRouter(): Router {
  const router = Router();
  const decisionStore = DecisionStore.getInstance();

  router.get('/:id/:timestamp', (req: Request, res: Response) => {
    try {
      const { id } = AgentIdParamSchema.parse({ id: req.params.id });
      const { timestamp } = req.params;
      const decision = decisionStore.getDecision(id, timestamp);

      if (!decision) {
        return res.status(404).json({ error: 'Decision not found' });
      }

      res.json(decision);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request', details: error.errors });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

