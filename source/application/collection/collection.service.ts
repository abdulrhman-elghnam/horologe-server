import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Brackets, DataSource, In } from 'typeorm';

import type { CreateCollectionDto, UpdateCollectionDto } from './dto/collection.dto.js';
import { Collection } from '../../database/model/collection.model.js';
import { CollectionRepository } from '../../database/repository/collection.repository.js';
import { WatchRepository } from '../../database/repository/watch.repository.js';
import { WatchStatusEnum } from '../../dependency/value/database.enum.js';
import { uniqueSlug } from '../../dependency/util/slug.js';

@Injectable()
export class CollectionService {
  constructor(
    private readonly collections: CollectionRepository,
    private readonly watches: WatchRepository,
    private readonly dataSource: DataSource,
  ) {}

  /** Active collections whose date window (if any) includes now. */
  listPublic() {
    return this.publicQuery().orderBy('collection.name', 'ASC').getMany();
  }

  listAll() {
    return this.collections.find({ options: { order: { createdAt: 'DESC' } } });
  }

  async findPublicBySlug(slug: string) {
    const collection = await this.publicQuery().andWhere('collection.slug = :slug', { slug }).getOne();
    if (!collection) throw new NotFoundException('Collection not found');

    const watches = await this.watches
      .repo()
      .createQueryBuilder('watch')
      .innerJoin('watch.collections', 'collection', 'collection.id = :id', { id: collection.id })
      .leftJoinAndSelect('watch.brand', 'brand')
      .where('watch.status = :status', { status: WatchStatusEnum.PUBLISHED })
      .orderBy('watch.createdAt', 'DESC')
      .getMany();
    return { ...collection, watches };
  }

  async findById(id: string) {
    const collection = await this.collections.findById({ id });
    if (!collection) throw new NotFoundException('Collection not found');
    return collection;
  }

  async create(input: CreateCollectionDto) {
    this.assertDates(input.startDate, input.endDate);
    const slug = await uniqueSlug(input.name, (candidate) => this.collections.exists({ where: { slug: candidate } }));
    return this.collections.create({ data: { ...input, slug } });
  }

  async update(id: string, input: UpdateCollectionDto) {
    const collection = await this.findById(id);
    this.assertDates(input.startDate ?? collection.startDate, input.endDate ?? collection.endDate);
    return this.collections.findByIdAndUpdate({ id, data: input });
  }

  async setStatus(id: string, isActive: boolean) {
    await this.findById(id);
    return this.collections.findByIdAndUpdate({ id, data: { isActive } });
  }

  async addWatches(id: string, watchIds: string[]) {
    await this.findById(id);
    const unique = [...new Set(watchIds)];
    const found = await this.watches.count({ where: { id: In(unique) } });
    if (found !== unique.length) throw new BadRequestException('One or more watches do not exist');

    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into('collection_watches')
      .values(unique.map((watchId) => ({ collection_id: id, watch_id: watchId })))
      .orIgnore()
      .execute();
    return { added: unique.length };
  }

  async removeWatch(id: string, watchId: string) {
    await this.findById(id);
    await this.dataSource.createQueryBuilder().relation(Collection, 'watches').of(id).remove(watchId);
    return { removed: true };
  }

  async remove(id: string) {
    await this.findById(id);
    await this.collections.deleteOne({ where: { id } });
    return { deleted: true };
  }

  private publicQuery() {
    return this.collections
      .repo()
      .createQueryBuilder('collection')
      .where('collection.isActive = true')
      .andWhere(new Brackets((qb) => qb.where('collection.startDate IS NULL').orWhere('collection.startDate <= now()')))
      .andWhere(new Brackets((qb) => qb.where('collection.endDate IS NULL').orWhere('collection.endDate >= now()')));
  }

  private assertDates(start?: Date | null, end?: Date | null) {
    if (start && end && start > end) throw new BadRequestException('startDate must be before endDate');
  }
}
