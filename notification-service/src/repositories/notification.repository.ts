import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { NotificationLog, NotificationFailure } from "../entities/notification-log.entity";

export interface PaginationInput {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface StorageShape {
  notifications: NotificationLog[];
  failures: NotificationFailure[];
}

export class NotificationRepository {
  private storagePath: string;

  constructor() {
    this.storagePath = path.resolve(process.cwd(), "storage", "notification-logs.json");
  }

  async saveLog(log: Omit<NotificationLog, "id" | "createdAt">): Promise<NotificationLog> {
    const payload: NotificationLog = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      ...log,
    };

    const store = await this.readStorage();
    store.notifications.unshift(payload);
    await this.writeStorage(store);
    return payload;
  }

  async saveFailure(failure: Omit<NotificationFailure, "id" | "createdAt">): Promise<NotificationFailure> {
    const payload: NotificationFailure = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      ...failure,
    };

    const store = await this.readStorage();
    store.failures.unshift(payload);
    await this.writeStorage(store);
    return payload;
  }

  async getLogs(pagination: PaginationInput = {}): Promise<PaginatedResult<NotificationLog>> {
    const page = Math.max(1, Number(pagination.page || 1));
    const pageSize = Math.max(1, Math.min(100, Number(pagination.pageSize || 25)));
    const store = await this.readStorage();
    const total = store.notifications.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const items = store.notifications.slice(start, start + pageSize);

    return {
      items,
      page,
      pageSize,
      total,
      totalPages,
    };
  }

  async getByRecipient(recipientId: string, pagination: PaginationInput = {}): Promise<PaginatedResult<NotificationLog>> {
    const page = Math.max(1, Number(pagination.page || 1));
    const pageSize = Math.max(1, Math.min(100, Number(pagination.pageSize || 25)));
    const store = await this.readStorage();
    const filtered = store.notifications.filter(n => n.recipientId === recipientId);
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return {
      items,
      page,
      pageSize,
      total,
      totalPages,
    };
  }

  private async readStorage(): Promise<StorageShape> {
    await this.ensureStorage();
    const raw = await fs.readFile(this.storagePath, "utf-8");
    const parsed = JSON.parse(raw) as StorageShape;
    return {
      notifications: parsed.notifications || [],
      failures: parsed.failures || [],
    };
  }

  private async writeStorage(data: StorageShape): Promise<void> {
    await this.ensureStorage();
    await fs.writeFile(this.storagePath, JSON.stringify(data, null, 2), "utf-8");
  }

  private async ensureStorage(): Promise<void> {
    const dir = path.dirname(this.storagePath);
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.access(this.storagePath);
    } catch {
      const initial: StorageShape = { notifications: [], failures: [] };
      await fs.writeFile(this.storagePath, JSON.stringify(initial, null, 2), "utf-8");
    }
  }
}
