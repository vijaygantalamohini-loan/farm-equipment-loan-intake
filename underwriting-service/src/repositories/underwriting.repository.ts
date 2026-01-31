import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { UnderwritingRequest, UnderwritingActivity, UnderwritingStatus } from "../entities/underwriting.entity";

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
  requests: UnderwritingRequest[];
  activities: UnderwritingActivity[];
}

export class UnderwritingRepository {
  private storagePath: string;

  constructor() {
    this.storagePath = path.resolve(process.cwd(), "storage", "underwriting.json");
  }

  async create(data: Omit<UnderwritingRequest, "id" | "createdAt" | "updatedAt">): Promise<UnderwritingRequest> {
    const request: UnderwritingRequest = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };

    const store = await this.readStorage();
    store.requests.unshift(request);
    await this.writeStorage(store);
    return request;
  }

  async findById(id: string): Promise<UnderwritingRequest | null> {
    const store = await this.readStorage();
    return store.requests.find(r => r.id === id) || null;
  }

  async findByApplicationId(applicationId: string): Promise<UnderwritingRequest | null> {
    const store = await this.readStorage();
    return store.requests.find(r => r.applicationId === applicationId) || null;
  }

  async update(id: string, updates: Partial<UnderwritingRequest>): Promise<UnderwritingRequest | null> {
    const store = await this.readStorage();
    const index = store.requests.findIndex(r => r.id === id);
    if (index === -1) return null;

    store.requests[index] = {
      ...store.requests[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.writeStorage(store);
    return store.requests[index];
  }

  async getAll(pagination: PaginationInput = {}): Promise<PaginatedResult<UnderwritingRequest>> {
    const page = Math.max(1, Number(pagination.page || 1));
    const pageSize = Math.max(1, Math.min(100, Number(pagination.pageSize || 25)));
    const store = await this.readStorage();
    const total = store.requests.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const items = store.requests.slice(start, start + pageSize);

    return {
      items,
      page,
      pageSize,
      total,
      totalPages,
    };
  }

  async getByLender(lenderId: string, pagination: PaginationInput = {}): Promise<PaginatedResult<UnderwritingRequest>> {
    const page = Math.max(1, Number(pagination.page || 1));
    const pageSize = Math.max(1, Math.min(100, Number(pagination.pageSize || 25)));
    const store = await this.readStorage();
    const filtered = store.requests.filter(r => r.lenderId === lenderId);
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

  async getByStatus(status: UnderwritingStatus, pagination: PaginationInput = {}): Promise<PaginatedResult<UnderwritingRequest>> {
    const page = Math.max(1, Number(pagination.page || 1));
    const pageSize = Math.max(1, Math.min(100, Number(pagination.pageSize || 25)));
    const store = await this.readStorage();
    const filtered = store.requests.filter(r => r.status === status);
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

  async addActivity(activity: Omit<UnderwritingActivity, "id" | "createdAt">): Promise<UnderwritingActivity> {
    const newActivity: UnderwritingActivity = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      ...activity,
    };

    const store = await this.readStorage();
    store.activities.unshift(newActivity);
    await this.writeStorage(store);
    return newActivity;
  }

  async getActivities(underwritingId: string): Promise<UnderwritingActivity[]> {
    const store = await this.readStorage();
    return store.activities.filter(a => a.underwritingId === underwritingId);
  }

  private async readStorage(): Promise<StorageShape> {
    await this.ensureStorage();
    const raw = await fs.readFile(this.storagePath, "utf-8");
    const parsed = JSON.parse(raw) as StorageShape;
    return {
      requests: parsed.requests || [],
      activities: parsed.activities || [],
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
      const initial: StorageShape = { requests: [], activities: [] };
      await fs.writeFile(this.storagePath, JSON.stringify(initial, null, 2), "utf-8");
    }
  }
}
