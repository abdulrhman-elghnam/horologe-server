import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import type { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';
import type { Category } from '../../database/model/category.model.js';
import { CategoryRepository } from '../../database/repository/category.repository.js';
import { uniqueSlug } from '../../dependency/util/slug.js';

export type CategoryNode = Category & { children: CategoryNode[] };

@Injectable()
export class CategoryService {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly dataSource: DataSource,
  ) {}

  listActive() {
    return this.categories.find({ where: { isActive: true }, options: { order: { name: 'ASC' } } });
  }

  listAll() {
    return this.categories.find({ options: { order: { name: 'ASC' } } });
  }

  /** Active categories nested under their parents. A child of an inactive parent is hidden too. */
  async tree(): Promise<CategoryNode[]> {
    const nodes = new Map<string, CategoryNode>((await this.listActive()).map((category) => [category.id, { ...category, children: [] }]));
    const roots: CategoryNode[] = [];
    for (const node of nodes.values()) {
      if (!node.parentId) roots.push(node);
      else nodes.get(node.parentId)?.children.push(node);
    }
    return roots;
  }

  async findPublicBySlug(slug: string) {
    const category = await this.categories.findOne({ where: { slug, isActive: true } });
    if (!category) throw new NotFoundException('Category not found');
    const children = await this.categories.find({ where: { parentId: category.id, isActive: true }, options: { order: { name: 'ASC' } } });
    return { ...category, children };
  }

  async findById(id: string) {
    const category = await this.categories.findById({ id });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async create(input: CreateCategoryDto) {
    if (input.parentId) await this.findById(input.parentId);
    const slug = await uniqueSlug(input.name, (candidate) => this.categories.exists({ where: { slug: candidate } }));
    return this.categories.create({ data: { ...input, slug } });
  }

  async update(id: string, input: UpdateCategoryDto) {
    await this.findById(id);
    if (input.parentId) await this.assertNoCycle(id, input.parentId);
    return this.categories.findByIdAndUpdate({ id, data: input });
  }

  async setStatus(id: string, isActive: boolean) {
    await this.findById(id);
    return this.categories.findByIdAndUpdate({ id, data: { isActive } });
  }

  async remove(id: string) {
    await this.findById(id);
    if (await this.categories.exists({ where: { parentId: id } })) {
      throw new ConflictException('Move or delete the sub-categories first');
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.query('DELETE FROM watch_categories WHERE category_id = $1', [id]);
      await this.categories.deleteOne({ where: { id }, manager });
    });
    return { deleted: true };
  }

  /** A category can't become its own ancestor. */
  private async assertNoCycle(id: string, parentId: string) {
    let current: string | null = parentId;
    for (let depth = 0; current && depth < 50; depth++) {
      if (current === id) throw new BadRequestException('A category cannot be moved under itself');
      const parent: Category = await this.findById(current);
      current = parent.parentId;
    }
  }
}
