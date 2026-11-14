import { Injectable } from '@nestjs/common';
import {
  DeepPartial,
  DeleteResult,
  EntityManager,
  FindOneOptions,
  FindOptionsOrder,
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
  ObjectLiteral,
  QueryDeepPartialEntity,
  Repository,
  SelectQueryBuilder,
  UpdateResult,
} from 'typeorm';

export type Where<T> = FindOptionsWhere<T> | FindOptionsWhere<T>[];

export interface ReadOptions<T> {
  select?: FindOptionsSelect<T>;
  relations?: FindOptionsRelations<T>;
  order?: FindOptionsOrder<T>;
  lock?: FindOneOptions<T>['lock'];
  withDeleted?: boolean;
}

export interface Tx {
  manager?: EntityManager;
}

export interface Paginated<T> {
  docs: T[];
  count: number;
  currentPage: number;
  size: number;
  pages: number;
}

/** Runs a query builder as one page. Same result shape as `DatabaseRepository.paginate`. */
export async function paginateQuery<T extends ObjectLiteral>(query: SelectQueryBuilder<T>, page = 1, size = 20): Promise<Paginated<T>> {
  const currentPage = Math.max(1, Math.floor(page));
  const limit = Math.max(1, Math.floor(size));
  const [docs, count] = await query
    .skip((currentPage - 1) * limit)
    .take(limit)
    .getManyAndCount();
  return { docs, count, currentPage, size: limit, pages: Math.ceil(count / limit) };
}

@Injectable()
export abstract class DatabaseRepository<T extends ObjectLiteral & { id: string }> {
  constructor(protected readonly repository: Repository<T>) {}

  /** The repository bound to `manager` when running inside a transaction. */
  repo(manager?: EntityManager): Repository<T> {
    return manager ? manager.withRepository(this.repository) : this.repository;
  }

  protected byId(id: string): FindOptionsWhere<T> {
    return { id } as FindOptionsWhere<T>;
  }

  async create({ data, manager }: { data: DeepPartial<T> } & Tx): Promise<T> {
    const repo = this.repo(manager);
    return repo.save(repo.create(data));
  }

  async createMany({ data, manager }: { data: DeepPartial<T>[] } & Tx): Promise<T[]> {
    const repo = this.repo(manager);
    return repo.save(repo.create(data));
  }

  async findById({ id, options, manager }: { id: string; options?: ReadOptions<T> } & Tx): Promise<T | null> {
    return this.repo(manager).findOne({ where: this.byId(id), ...options });
  }

  async findOne({ where, options, manager }: { where: Where<T>; options?: ReadOptions<T> } & Tx): Promise<T | null> {
    return this.repo(manager).findOne({ where, ...options });
  }

  async find({ where, options, skip, take, manager }: { where?: Where<T>; options?: ReadOptions<T>; skip?: number; take?: number } & Tx = {}): Promise<T[]> {
    return this.repo(manager).find({ where, ...options, skip, take });
  }

  async count({ where, manager }: { where?: Where<T> } & Tx = {}): Promise<number> {
    return this.repo(manager).count({ where });
  }

  async exists({ where, manager }: { where: Where<T> } & Tx): Promise<boolean> {
    return this.repo(manager).exists({ where });
  }

  async paginate({
    where,
    options,
    page = 1,
    size = 5,
    manager,
  }: { where?: Where<T>; options?: ReadOptions<T>; page?: number | string; size?: number | string } & Tx): Promise<Paginated<T>> {
    const currentPage = Math.max(1, Math.floor(Number(page) || 1));
    const limit = Math.max(1, Math.floor(Number(size) || 5));

    const [docs, count] = await this.repo(manager).findAndCount({
      where,
      ...options,
      skip: (currentPage - 1) * limit,
      take: limit,
    });

    return { docs, count, currentPage, size: limit, pages: Math.ceil(count / limit) };
  }

  async updateOne({ where, data, manager }: { where: Where<T>; data: QueryDeepPartialEntity<T> } & Tx): Promise<UpdateResult> {
    const repo = this.repo(manager);
    const row = await repo.findOne({ where, select: { id: true } as FindOptionsSelect<T> });
    if (!row) return { raw: [], affected: 0, generatedMaps: [] };
    return repo.update(row.id, data);
  }

  async updateMany({ where, data, manager }: { where: FindOptionsWhere<T>; data: QueryDeepPartialEntity<T> } & Tx): Promise<UpdateResult> {
    return this.repo(manager).update(where, data);
  }

  async findOneAndUpdate({ where, data, options, manager }: { where: Where<T>; data: DeepPartial<T>; options?: ReadOptions<T> } & Tx): Promise<T | null> {
    const repo = this.repo(manager);
    const entity = await repo.findOne({ where, ...options });
    if (!entity) return null;
    return repo.save(repo.merge(entity, data));
  }

  async findByIdAndUpdate({ id, data, options, manager }: { id: string; data: DeepPartial<T>; options?: ReadOptions<T> } & Tx): Promise<T | null> {
    return this.findOneAndUpdate({ where: this.byId(id), data, options, manager });
  }

  async deleteOne({ where, manager }: { where: Where<T> } & Tx): Promise<DeleteResult> {
    const repo = this.repo(manager);
    const row = await repo.findOne({ where, select: { id: true } as FindOptionsSelect<T> });
    if (!row) return { raw: [], affected: 0 };
    return repo.delete(row.id);
  }

  async deleteMany({ where, manager }: { where: FindOptionsWhere<T> } & Tx): Promise<DeleteResult> {
    return this.repo(manager).delete(where);
  }

  async findOneAndDelete({ where, options, manager }: { where: Where<T>; options?: ReadOptions<T> } & Tx): Promise<T | null> {
    const repo = this.repo(manager);
    const entity = await repo.findOne({ where, ...options });
    if (!entity) return null;
    await repo.delete(entity.id);
    return entity;
  }

  async findByIdAndDelete({ id, manager }: { id: string } & Tx): Promise<T | null> {
    return this.findOneAndDelete({ where: this.byId(id), manager });
  }
}
