import { Router } from 'express';
import { WorkflowInstanceService } from '../services/WorkflowInstanceService';
import {
  CreateWorkflowInstanceSchema,
  TransitionWorkflowSchema,
  UpdateWorkflowContextSchema,
  WorkflowQuerySchema,
} from '../dtos/workflow.dto';

const router = Router();
const service = new WorkflowInstanceService();

router.post('/', async (req, res, next) => {
  try {
    const dto = CreateWorkflowInstanceSchema.parse(req.body);
    const instance = await service.createInstance(dto);
    res.status(201).json(instance);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const query = WorkflowQuerySchema.parse({
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
      status: req.query.status,
      entityType: req.query.entityType,
      tenantId: req.query.tenantId,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    });

    const result = await service.getInstances(
      {
        status: query.status as any,
        entityType: query.entityType,
        tenantId: query.tenantId,
      },
      query.page,
      query.pageSize,
      query.sortBy,
      query.sortOrder as any
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const instance = await service.getInstanceById(req.params.id);
    res.json(instance);
  } catch (error) {
    next(error);
  }
});

router.get('/entity/:entityType/:entityId', async (req, res, next) => {
  try {
    const instances = await service.getInstancesByEntity(
      req.params.entityId,
      req.params.entityType
    );
    res.json(instances);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/transition', async (req, res, next) => {
  try {
    const dto = TransitionWorkflowSchema.parse(req.body);
    const instance = await service.transition(req.params.id, dto);
    res.json(instance);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/context', async (req, res, next) => {
  try {
    const dto = UpdateWorkflowContextSchema.parse(req.body);
    const instance = await service.updateContext(req.params.id, dto);
    res.json(instance);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/start', async (req, res, next) => {
  try {
    const instance = await service.startInstance(req.params.id);
    res.json(instance);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/complete', async (req, res, next) => {
  try {
    const instance = await service.completeInstance(req.params.id);
    res.json(instance);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/fail', async (req, res, next) => {
  try {
    const { errorMessage } = req.body;
    const instance = await service.failInstance(req.params.id, errorMessage);
    res.json(instance);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const instance = await service.cancelInstance(req.params.id);
    res.json(instance);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 25;
    const result = await service.getTransitionHistory(req.params.id, page, pageSize);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await service.deleteInstance(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
