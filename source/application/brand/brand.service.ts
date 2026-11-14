import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ILike, type FindOptionsWhere } from 'typeorm';

import type { AdminBrandQueryDto, CreateBrandDto, UpdateBrandDto } from './dto/brand.dto.js';
import type { Brand } from '../../database/model/brand.model.js';
import { BrandRepository } from '../../database/repository/brand.repository.js';
import { WatchRepository } from '../../database/repository/watch.repository.js';
import { sortColumn, sortDirection } from '../../dependency/dto/pagination.dto.js';
import { escapeLike } from '../../dependency/service/util.service.js';
import { uniqueSlug } from '../../dependency/util/slug.js';

@Injectable()
export class BrandService {
  constructor(
    private readonly brands: BrandRepository,
    private readonly watches: WatchRepository,
  ) {}

  /** Public listing shows active brands only; admins can filter by status. */
  list({ page, limit, search, isActive, sortBy, sortOrder }: AdminBrandQueryDto, publicOnly: boolean) {
    const where: FindOptionsWhere<Brand> = {};
    if (publicOnly) where.isActive = true;
    else if (isActive !== undefined) where.isActive = isActive;
    if (search) where.name = ILike(`%${escapeLike(search)}%`);

    const column = sortColumn(sortBy, { name: 'name', createdAt: 'createdAt' }, 'name');
    return this.brands.paginate({ where, page, size: limit, options: { order: { [column]: sortBy ? sortDirection(sortOrder) : 'ASC' } } });
  }

  async findPublicBySlug(slug: string) {
    const brand = await this.brands.findOne({ where: { slug, isActive: true } });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async findById(id: string) {
    const brand = await this.brands.findById({ id });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async create(input: CreateBrandDto) {
    const slug = await uniqueSlug(input.name, (candidate) => this.brands.exists({ where: { slug: candidate } }));
    return this.brands.create({ data: { ...input, slug } });
  }

  async update(id: string, input: UpdateBrandDto) {
    const brand = await this.findById(id);
    return this.brands.findByIdAndUpdate({ id: brand.id, data: input });
  }

  async setStatus(id: string, isActive: boolean) {
    await this.findById(id);
    return this.brands.findByIdAndUpdate({ id, data: { isActive } });
  }

  async remove(id: string) {
    await this.findById(id);
    if (await this.watches.exists({ where: { brandId: id } })) {
      throw new ConflictException('This brand still has watches. Deactivate it instead');
    }
    await this.brands.deleteOne({ where: { id } });
    return { deleted: true };
  }
}
