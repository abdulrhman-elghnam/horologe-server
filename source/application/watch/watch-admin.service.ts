import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';

import type { CreateVariantDto, CreateWatchDto, UpdateVariantDto, UpdateWatchDto, VariantPriceDto } from './dto/watch.dto.js';
import { WatchCatalogService } from './watch-catalog.service.js';
import { presentImage, presentVariant } from './watch.presenter.js';
import { InventoryService, type StockChange } from '../inventory/inventory.service.js';
import { NotificationService } from '../notification/notification.service.js';
import { RealtimeEvent } from '../realtime/realtime.event.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { Category } from '../../database/model/category.model.js';
import { Watch } from '../../database/model/watch.model.js';
import type { WatchVariant } from '../../database/model/watch-variant.model.js';
import { BrandRepository } from '../../database/repository/brand.repository.js';
import { CategoryRepository } from '../../database/repository/category.repository.js';
import { OrderItemRepository } from '../../database/repository/order-item.repository.js';
import { WatchImageRepository } from '../../database/repository/watch-image.repository.js';
import { WatchRepository } from '../../database/repository/watch.repository.js';
import { WatchVariantRepository } from '../../database/repository/watch-variant.repository.js';
import { WishlistRepository } from '../../database/repository/wishlist.repository.js';
import { StorageService, extensionForMime } from '../../dependency/service/storage.service.js';
import { isUniqueViolation } from '../../dependency/service/util.service.js';
import { NotificationTypeEnum, WatchStatusEnum } from '../../dependency/value/database.enum.js';
import { uniqueSlug } from '../../dependency/util/slug.js';

const MAX_IMAGES_PER_WATCH = 12;

/** Write side of the catalog. Every method is admin-only (enforced by the controller). */
@Injectable()
export class WatchAdminService {
  constructor(
    private readonly watches: WatchRepository,
    private readonly variants: WatchVariantRepository,
    private readonly images: WatchImageRepository,
    private readonly brands: BrandRepository,
    private readonly categories: CategoryRepository,
    private readonly orderItems: OrderItemRepository,
    private readonly wishlist: WishlistRepository,
    private readonly inventory: InventoryService,
    private readonly catalog: WatchCatalogService,
    private readonly notifications: NotificationService,
    private readonly realtime: RealtimeService,
    private readonly storage: StorageService,
    private readonly dataSource: DataSource,
  ) {}

  // ── Watches ──

  async create({ variants = [], categoryIds, specification, ...input }: CreateWatchDto, adminId: string) {
    await this.assertBrand(input.brandId);
    const categories = await this.loadCategories(categoryIds);
    const slug = await uniqueSlug(input.name, (candidate) => this.watches.exists({ where: { slug: candidate } }));

    const { watchId, stock } = await this.saveUnique(() =>
      this.dataSource.transaction(async (manager) => {
        const watch = await this.watches.create({
          data: { ...input, slug, status: WatchStatusEnum.DRAFT, specification: { ...emptySpecification, ...specification }, categories },
          manager,
        });
        const stock: StockChange[] = [];
        for (const variant of variants) stock.push(await this.insertVariant(watch.id, variant, adminId, manager));
        await this.refreshMinPrice(watch.id, manager);
        return { watchId: watch.id, stock };
      }),
    );

    await this.inventory.publish(stock);
    return this.catalog.findForAdmin(watchId);
  }

  async update(id: string, { categoryIds, specification, ...input }: UpdateWatchDto) {
    const watch = await this.findWatch(id, { categories: true });
    if (input.brandId) await this.assertBrand(input.brandId);

    if (categoryIds) watch.categories = await this.loadCategories(categoryIds);
    if (specification) watch.specification = { ...watch.specification, ...specification };
    Object.assign(watch, input);

    await this.watches.repo().save(watch);
    return this.catalog.findForAdmin(id);
  }

  /** Publishing needs at least one active variant with a price. */
  async setStatus(id: string, status: WatchStatusEnum) {
    const watch = await this.findWatch(id);
    if (status === WatchStatusEnum.PUBLISHED && !(await this.variants.exists({ where: { watchId: id, isActive: true } }))) {
      throw new BadRequestException('Add at least one active variant before publishing');
    }

    await this.watches.updateMany({
      where: { id },
      data: { status, ...(status === WatchStatusEnum.PUBLISHED && !watch.publishedAt ? { publishedAt: new Date() } : {}) },
    });
    return this.catalog.findForAdmin(id);
  }

  /** Watches that were ever ordered are archived, not deleted, so order history stays intact. */
  async remove(id: string) {
    await this.findWatch(id);
    if (await this.orderItems.exists({ where: { watchId: id } })) {
      throw new ConflictException('This watch has orders. Archive it instead');
    }

    const images = await this.images.find({ where: { watchId: id }, options: { select: { id: true, storageKey: true } } });
    await this.watches.deleteOne({ where: { id } });
    await Promise.all(images.map((image) => this.storage.remove(image.storageKey).catch(() => undefined)));
    return { deleted: true };
  }

  // ── Images ──

  async addImages(watchId: string, files: Express.Multer.File[], alt?: string) {
    if (!files?.length) throw new BadRequestException('Image file is required');
    await this.findWatch(watchId);

    const existing = await this.images.count({ where: { watchId } });
    if (existing + files.length > MAX_IMAGES_PER_WATCH) throw new BadRequestException(`A watch can have up to ${MAX_IMAGES_PER_WATCH} images`);

    const saved = [];
    for (const [index, file] of files.entries()) {
      const storageKey = await this.storage.save('watches', file.buffer, extensionForMime(file.mimetype));
      saved.push(await this.images.create({ data: { watchId, storageKey, mimeType: file.mimetype, alt: alt ?? null, position: existing + index } }));
    }
    return saved.map(presentImage);
  }

  async removeImage(watchId: string, imageId: string) {
    const image = await this.images.findOne({ where: { id: imageId, watchId }, options: { select: { id: true, storageKey: true } } });
    if (!image) throw new NotFoundException('Image not found');
    await this.images.deleteOne({ where: { id: image.id } });
    await this.storage.remove(image.storageKey).catch(() => undefined);
    return { deleted: true };
  }

  // ── Variants ──

  async addVariant(watchId: string, input: CreateVariantDto, adminId: string) {
    await this.findWatch(watchId);
    const { variantId, stock } = await this.saveUnique(() =>
      this.dataSource.transaction(async (manager) => {
        const stock = await this.insertVariant(watchId, input, adminId, manager);
        await this.refreshMinPrice(watchId, manager);
        return { variantId: stock.inventory.variantId, stock };
      }),
    );
    await this.inventory.publish([stock]);
    return this.presentVariantById(variantId);
  }

  async updateVariant(watchId: string, variantId: string, input: UpdateVariantDto) {
    await this.findVariant(watchId, variantId);
    await this.saveUnique(() => this.variants.updateMany({ where: { id: variantId }, data: input }));
    return this.presentVariantById(variantId);
  }

  /** Changes the price, refreshes the watch's minPrice and tells watchers and wishlisters about drops. */
  async updatePrice(watchId: string, variantId: string, { price, compareAtPrice }: VariantPriceDto) {
    const variant = await this.findVariant(watchId, variantId);
    if (compareAtPrice !== undefined && compareAtPrice <= price) throw new BadRequestException('compareAtPrice must be higher than price');

    await this.dataSource.transaction(async (manager) => {
      await this.variants.updateMany({ where: { id: variantId }, data: { price, ...(compareAtPrice !== undefined ? { compareAtPrice } : {}) }, manager });
      await this.refreshMinPrice(watchId, manager);
    });

    if (price !== variant.price) await this.announcePriceChange(variant, price);
    return this.presentVariantById(variantId);
  }

  async setVariantStatus(watchId: string, variantId: string, isActive: boolean) {
    await this.findVariant(watchId, variantId);
    await this.dataSource.transaction(async (manager) => {
      await this.variants.updateMany({ where: { id: variantId }, data: { isActive }, manager });
      await this.refreshMinPrice(watchId, manager);
    });
    return this.presentVariantById(variantId);
  }

  async removeVariant(watchId: string, variantId: string) {
    await this.findVariant(watchId, variantId);
    if (await this.orderItems.exists({ where: { variantId } })) throw new ConflictException('This variant has orders. Deactivate it instead');

    await this.dataSource.transaction(async (manager) => {
      await this.variants.deleteOne({ where: { id: variantId }, manager });
      await this.refreshMinPrice(watchId, manager);
    });
    return { deleted: true };
  }

  // ── Helpers ──

  private async insertVariant(watchId: string, { initialStock = 0, lowStockThreshold, ...input }: CreateVariantDto, adminId: string, manager: EntityManager) {
    if (input.compareAtPrice !== undefined && input.compareAtPrice <= input.price) throw new BadRequestException('compareAtPrice must be higher than price');
    const variant = await this.variants.create({ data: { ...input, watchId }, manager });
    return this.inventory.createForVariant({ variantId: variant.id, quantity: initialStock, lowStockThreshold, adminId, manager });
  }

  /** Keeps watches.min_price equal to the cheapest active variant (used for price filters and sorting). */
  private async refreshMinPrice(watchId: string, manager: EntityManager) {
    await manager.query(
      `UPDATE watches SET min_price = (SELECT MIN(price) FROM watch_variants WHERE watch_id = $1 AND is_active = true), updated_at = now() WHERE id = $1`,
      [watchId],
    );
  }

  private async announcePriceChange(variant: WatchVariant, newPrice: number) {
    const payload = { watchId: variant.watchId, variantId: variant.id, sku: variant.sku, oldPrice: variant.price, newPrice };
    this.realtime.emitToWatch(variant.watchId, RealtimeEvent.WATCH_PRICE_UPDATED, payload);
    if (newPrice >= variant.price) return;

    this.realtime.emitToWatch(variant.watchId, RealtimeEvent.WATCH_PRICE_DROPPED, payload);
    const watch = await this.watches.findById({ id: variant.watchId, options: { select: { id: true, name: true, status: true } } });
    if (watch?.status !== WatchStatusEnum.PUBLISHED) return;

    const fans = await this.wishlist.find({ where: { watchId: variant.watchId }, options: { select: { userId: true } } });
    await Promise.all(
      fans.map(({ userId }) =>
        this.notifications.notify({
          userId,
          type: NotificationTypeEnum.PRICE,
          title: 'Price drop',
          message: `${watch.name} is now ${newPrice.toFixed(2)} (was ${variant.price.toFixed(2)}).`,
          referenceId: variant.watchId,
          data: payload,
          event: RealtimeEvent.WATCH_PRICE_DROPPED,
          eventPayload: payload,
        }),
      ),
    );
  }

  private async presentVariantById(variantId: string) {
    const variant = await this.variants.findOne({ where: { id: variantId }, options: { relations: { inventory: true } } });
    return presentVariant(variant!, { admin: true });
  }

  private async findWatch(id: string, relations?: { categories: true }): Promise<Watch> {
    const watch = await this.watches.findById({ id, options: relations ? { relations } : undefined });
    if (!watch) throw new NotFoundException('Watch not found');
    return watch;
  }

  private async findVariant(watchId: string, variantId: string): Promise<WatchVariant> {
    const variant = await this.variants.findOne({ where: { id: variantId, watchId } });
    if (!variant) throw new NotFoundException('Variant not found');
    return variant;
  }

  private async assertBrand(brandId: string) {
    if (!(await this.brands.exists({ where: { id: brandId } }))) throw new BadRequestException('Brand does not exist');
  }

  private async loadCategories(ids?: string[]): Promise<Category[] | undefined> {
    if (!ids) return undefined;
    const unique = [...new Set(ids)];
    const categories = await this.categories.find({ where: { id: In(unique) } });
    if (categories.length !== unique.length) throw new BadRequestException('One or more categories do not exist');
    return categories;
  }

  /** Turns a duplicate-SKU database error into a 409. */
  private async saveUnique<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('A variant with this SKU already exists');
      throw error;
    }
  }
}

const emptySpecification = {
  caseMaterial: null,
  caseDiameter: null,
  strapMaterial: null,
  dialColor: null,
  glassType: null,
  waterResistance: null,
  powerReserve: null,
};
