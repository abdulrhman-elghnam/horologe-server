import { Injectable, NotFoundException } from '@nestjs/common';
import type { SelectQueryBuilder } from 'typeorm';

import type { AdminWatchQueryDto } from './dto/watch.dto.js';
import { presentWatch } from './watch.presenter.js';
import type { Watch } from '../../database/model/watch.model.js';
import { paginateQuery } from '../../database/repository/base.repository.js';
import { WatchRepository } from '../../database/repository/watch.repository.js';
import { sortColumn, sortDirection } from '../../dependency/dto/pagination.dto.js';
import { escapeLike } from '../../dependency/service/util.service.js';
import { WatchStatusEnum } from '../../dependency/value/database.enum.js';

const SORTABLE = {
  price: 'watch.minPrice',
  createdAt: 'watch.createdAt',
  publishedAt: 'watch.publishedAt',
  name: 'watch.name',
  rating: 'watch.ratingAverage',
  popularity: 'watch.soldCount',
};

const SHOWCASE_LIMIT = 12;

/** Read side of the catalog: listing, search, filters and product pages. */
@Injectable()
export class WatchCatalogService {
  constructor(private readonly watches: WatchRepository) {}

  async search(query: AdminWatchQueryDto, { admin = false } = {}) {
    const qb = this.baseQuery(admin);
    this.applyFilters(qb, query, admin);
    qb.orderBy(sortColumn(query.sortBy, SORTABLE, 'watch.createdAt'), sortDirection(query.sortOrder), 'NULLS LAST').addOrderBy('watch.id');

    const page = await paginateQuery(qb, query.page, query.limit);
    return { ...page, docs: page.docs.map((watch) => presentWatch(watch, { admin })) };
  }

  featured() {
    return this.showcase((qb) => qb.andWhere('watch.isFeatured = true').orderBy('watch.publishedAt', 'DESC'));
  }

  newArrivals() {
    return this.showcase((qb) => qb.orderBy('watch.publishedAt', 'DESC', 'NULLS LAST'));
  }

  bestSellers() {
    return this.showcase((qb) => qb.andWhere('watch.soldCount > 0').orderBy('watch.soldCount', 'DESC'));
  }

  async findPublicBySlug(slug: string) {
    const watch = await this.detailQuery(false).andWhere('watch.slug = :slug', { slug }).getOne();
    if (!watch) throw new NotFoundException('Watch not found');
    return presentWatch(watch);
  }

  async findForAdmin(id: string) {
    const watch = await this.detailQuery(true).andWhere('watch.id = :id', { id }).getOne();
    if (!watch) throw new NotFoundException('Watch not found');
    return presentWatch(watch, { admin: true });
  }

  // ── Query building ──

  /** Listing query: brand + images; shoppers only see published watches of active brands. */
  private baseQuery(admin: boolean): SelectQueryBuilder<Watch> {
    const qb = this.watches.repo().createQueryBuilder('watch').leftJoinAndSelect('watch.brand', 'brand').leftJoinAndSelect('watch.images', 'image');
    if (!admin) qb.where('watch.status = :published', { published: WatchStatusEnum.PUBLISHED }).andWhere('brand.isActive = true');
    return qb;
  }

  private detailQuery(admin: boolean) {
    return this.baseQuery(admin)
      .leftJoinAndSelect('watch.variants', 'variant')
      .leftJoinAndSelect('variant.inventory', 'inventory')
      .leftJoinAndSelect('watch.categories', 'category');
  }

  private async showcase(customize: (qb: SelectQueryBuilder<Watch>) => SelectQueryBuilder<Watch>) {
    const watches = await customize(this.baseQuery(false)).take(SHOWCASE_LIMIT).getMany();
    return watches.map((watch) => presentWatch(watch));
  }

  private applyFilters(qb: SelectQueryBuilder<Watch>, query: AdminWatchQueryDto, admin: boolean) {
    const { search, brandId, categoryId, collectionId, gender, movement, minPrice, maxPrice, status } = query;

    if (search) {
      qb.andWhere('(watch.name ILIKE :search OR watch.model ILIKE :search OR watch.referenceNumber ILIKE :search OR brand.name ILIKE :search)', {
        search: `%${escapeLike(search)}%`,
      });
    }
    if (brandId) qb.andWhere('watch.brandId = :brandId', { brandId });
    if (gender) qb.andWhere('watch.gender = :gender', { gender });
    if (movement) qb.andWhere('watch.movement = :movement', { movement });
    if (minPrice !== undefined) qb.andWhere('watch.minPrice >= :minPrice', { minPrice });
    if (maxPrice !== undefined) qb.andWhere('watch.minPrice <= :maxPrice', { maxPrice });
    if (admin && status) qb.andWhere('watch.status = :status', { status });

    if (categoryId) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM watch_categories wc JOIN categories c ON c.id = wc.category_id
                 WHERE wc.watch_id = watch.id AND (c.id = :categoryId OR c.parent_id = :categoryId))`,
        { categoryId },
      );
    }
    if (collectionId) {
      qb.andWhere('EXISTS (SELECT 1 FROM collection_watches cw WHERE cw.watch_id = watch.id AND cw.collection_id = :collectionId)', { collectionId });
    }
  }
}
