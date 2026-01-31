import { Router } from 'express';
import { WorkflowDefinitionService } from '../services/WorkflowDefinitionService';
import { CreateWorkflowDefinitionSchema } from '../dtos/workflow.dto';

const router = Router();
const service = new WorkflowDefinitionService();

router.post('/', async (req, res, next) => {
  try {
    const dto = CreateWorkflowDefinitionSchema.parse(req.body);
    const definition = await service.createDefinition(dto);
    res.status(201).json(definition);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
    const definitions = await service.getAllDefinitions(isActive);
    res.json(definitions);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const definition = await service.getDefinitionById(req.params.id);
    res.json(definition);
  } catch (error) {
    next(error);
  }
});

router.get('/name/:name', async (req, res, next) => {
  try {
    const definition = await service.getDefinitionByName(req.params.name);
    res.json(definition);
  } catch (error) {
    next(error);
  }
});

router.get('/type/:type', async (req, res, next) => {
  try {
    const definitions = await service.getDefinitionsByType(req.params.type as any);
    res.json(definitions);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const definition = await service.updateDefinition(req.params.id, req.body);
    res.json(definition);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/deactivate', async (req, res, next) => {
  try {
    const definition = await service.deactivateDefinition(req.params.id);
    res.json(definition);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await service.deleteDefinition(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
