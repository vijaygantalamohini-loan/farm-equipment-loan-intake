import { Router } from 'express';
import { WorkflowTaskService } from '../services/WorkflowTaskService';
import { CreateWorkflowTaskSchema, UpdateWorkflowTaskSchema } from '../dtos/workflow.dto';

const router = Router();
const service = new WorkflowTaskService();

router.post('/', async (req, res, next) => {
  try {
    const dto = CreateWorkflowTaskSchema.parse(req.body);
    const task = await service.createTask(dto);
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 25;

    const filters = {
      workflowInstanceId: req.query.workflowInstanceId as string | undefined,
      status: req.query.status as any,
      assignedTo: req.query.assignedTo as string | undefined,
      assignedRole: req.query.assignedRole as string | undefined,
      type: req.query.type as string | undefined,
    };

    const result = await service.getTasks(filters, page, pageSize);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/pending', async (req, res, next) => {
  try {
    const assignedTo = req.query.assignedTo as string | undefined;
    const tasks = await service.getPendingTasks(assignedTo);
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

router.get('/overdue', async (req, res, next) => {
  try {
    const tasks = await service.getOverdueTasks();
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const task = await service.getTaskById(req.params.id);
    res.json(task);
  } catch (error) {
    next(error);
  }
});

router.get('/workflow/:workflowInstanceId', async (req, res, next) => {
  try {
    const tasks = await service.getTasksByWorkflowInstance(req.params.workflowInstanceId);
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const dto = UpdateWorkflowTaskSchema.parse(req.body);
    const task = await service.updateTask(req.params.id, dto);
    res.json(task);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/start', async (req, res, next) => {
  try {
    const task = await service.startTask(req.params.id);
    res.json(task);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/complete', async (req, res, next) => {
  try {
    const { output } = req.body;
    const task = await service.completeTask(req.params.id, output);
    res.json(task);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/fail', async (req, res, next) => {
  try {
    const { errorMessage } = req.body;
    const task = await service.failTask(req.params.id, errorMessage);
    res.json(task);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const task = await service.cancelTask(req.params.id);
    res.json(task);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await service.deleteTask(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
