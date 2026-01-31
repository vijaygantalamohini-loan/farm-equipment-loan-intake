import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { WorkflowDefinitionController, WorkflowInstanceController, WorkflowTaskController } from './controllers';
import { initializeDatabase } from './config/database';
import { EventEmitter } from './events/EventEmitter';
import { NotificationEventHandler, ApplicationEventHandler, UnderwritingEventHandler } from './events/handlers';
import { WorkflowEventType } from './events/types';

export class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(morgan('combined'));
  }

  private initializeRoutes(): void {
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    this.app.use('/api/workflow-definitions', WorkflowDefinitionController);
    this.app.use('/api/workflow-instances', WorkflowInstanceController);
    this.app.use('/api/workflow-tasks', WorkflowTaskController);
  }

  private initializeErrorHandling(): void {
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('Error:', err);

      if (err.name === 'ZodError') {
        return res.status(400).json({
          error: 'Validation Error',
          message: err.message,
        });
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
      });
    });
  }

  public async initialize(): Promise<void> {
    await initializeDatabase();
    this.initializeEventHandlers();
  }

  private initializeEventHandlers(): void {
    const eventEmitter = EventEmitter.getInstance();

    const notificationHandler = new NotificationEventHandler();
    const applicationHandler = new ApplicationEventHandler();
    const underwritingHandler = new UnderwritingEventHandler();

    Object.values(WorkflowEventType).forEach(eventType => {
      eventEmitter.on(eventType, notificationHandler);
      eventEmitter.on(eventType, applicationHandler);
      eventEmitter.on(eventType, underwritingHandler);
    });
  }

  public listen(port: number): void {
    const server = this.app.listen(port, () => {
      console.log(`Workflow Engine listening on port ${port}`);
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      console.error('Server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use`);
      }
    });

    // Handle unhandled rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      console.error('Uncaught Exception:', error);
    });
  }
}
