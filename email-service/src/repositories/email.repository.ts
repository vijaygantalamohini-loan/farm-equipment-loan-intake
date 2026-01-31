import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { EmailFailure, EmailLog } from "../entities/email-log.entity";

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
  logs: EmailLog[];
  failures: EmailFailure[];
}

export class EmailRepository {
  private storagePath: string;

  constructor() {
    this.storagePath = path.resolve(process.cwd(), "storage", "email-logs.json");
  }

  async saveLog(log: Omit<EmailLog, "id" | "createdAt">): Promise<EmailLog> {
    const payload: EmailLog = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      ...log,
    };

    const store = await this.readStorage();
    store.logs.unshift(payload);
    await this.writeStorage(store);
    return payload;
  }

  async saveFailure(failure: Omit<EmailFailure, "id" | "createdAt">): Promise<EmailFailure> {
    const payload: EmailFailure = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      ...failure,
    };

    const store = await this.readStorage();
    store.failures.unshift(payload);
    await this.writeStorage(store);
    return payload;
  }

  async getLogs(pagination: PaginationInput = {}): Promise<PaginatedResult<EmailLog>> {
    const page = Math.max(1, Number(pagination.page || 1));
    const pageSize = Math.max(1, Math.min(100, Number(pagination.pageSize || 25)));
    const store = await this.readStorage();
    const total = store.logs.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const items = store.logs.slice(start, start + pageSize);

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
      logs: parsed.logs || [],
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
      const initial: StorageShape = { logs: [], failures: [] };
      await fs.writeFile(this.storagePath, JSON.stringify(initial, null, 2), "utf-8");
    }
  }
}
