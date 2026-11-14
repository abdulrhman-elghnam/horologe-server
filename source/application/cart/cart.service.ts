import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { MAX_QUANTITY_PER_ITEM, type AddCartItemDto } from './dto/cart.dto.js';
import { CartItem } from '../../database/model/cart.model.js';
import { CartItemRepository } from '../../database/repository/cart-item.repository.js';
import { CartRepository } from '../../database/repository/cart.repository.js';
import { WatchVariantRepository } from '../../database/repository/watch-variant.repository.js';
import { SignedUrl } from '../../dependency/presenter.js';
import { WatchStatusEnum } from '../../dependency/value/database.enum.js';
import { multiplyMoney, sumMoney } from '../../dependency/util/money.js';

/** A cart line priced with live data. */
export interface CartLine {
  itemId: string;
  variantId: string;
  watchId: string;
  watchName: string;
  watchSlug: string;
  sku: string;
  color: string | null;
  imageId: string | null;
  categoryIds: string[];
  unitPrice: number;
  priceAtAdd: number;
  quantity: number;
  lineTotal: number;
  availableQuantity: number;
  /** Why the line can't be bought right now, if it can't. */
  issue: 'unavailable' | 'insufficient_stock' | null;
}

@Injectable()
export class CartService {
  constructor(
    private readonly carts: CartRepository,
    private readonly items: CartItemRepository,
    private readonly variants: WatchVariantRepository,
  ) {}

  async getCart(userId: string) {
    const lines = await this.lines(userId);
    const purchasable = lines.filter((line) => !line.issue);
    return {
      items: lines.map(({ categoryIds: _categories, imageId, ...line }) => ({
        ...line,
        image: imageId ? SignedUrl.sign('image', imageId) : null,
        priceChanged: line.unitPrice !== line.priceAtAdd,
      })),
      itemCount: purchasable.reduce((count, line) => count + line.quantity, 0),
      subtotal: sumMoney(purchasable.map((line) => line.lineTotal)),
      hasIssues: purchasable.length !== lines.length,
    };
  }

  async addItem(userId: string, { variantId, quantity }: AddCartItemDto) {
    const variant = await this.purchasableVariant(variantId);
    const cartId = await this.cartIdFor(userId);
    const existing = await this.items.findOne({ where: { cartId, variantId } });
    const total = (existing?.quantity ?? 0) + quantity;

    this.assertQuantity(total, variant.inventory?.availableQuantity ?? 0);
    if (existing) await this.items.updateMany({ where: { id: existing.id }, data: { quantity: total, priceAtAdd: variant.price } });
    else await this.items.create({ data: { cartId, variantId, quantity, priceAtAdd: variant.price } });

    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, quantity: number) {
    const item = await this.findItem(userId, itemId);
    const variant = await this.purchasableVariant(item.variantId);
    this.assertQuantity(quantity, variant.inventory?.availableQuantity ?? 0);
    await this.items.updateMany({ where: { id: item.id }, data: { quantity } });
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const item = await this.findItem(userId, itemId);
    await this.items.deleteOne({ where: { id: item.id } });
    return this.getCart(userId);
  }

  async clear(userId: string) {
    const cart = await this.carts.findOne({ where: { userId } });
    if (cart) await this.items.deleteMany({ where: { cartId: cart.id } });
    return { cleared: true };
  }

  /**
   * Live-priced lines for checkout and coupon validation.
   * Throws when the cart is empty or any line can't be bought, so the customer fixes the cart first.
   */
  async getCheckoutLines(userId: string): Promise<CartLine[]> {
    const lines = await this.lines(userId);
    if (!lines.length) throw new BadRequestException({ message: 'Your cart is empty', code: 'CART_EMPTY' });

    const problems = lines.filter((line) => line.issue);
    if (problems.length) {
      throw new ConflictException({
        message: 'Some items in your cart are no longer available in the requested quantity',
        code: 'CART_NEEDS_ATTENTION',
        items: problems.map(({ itemId, sku, issue, availableQuantity }) => ({ itemId, sku, issue, availableQuantity })),
      });
    }
    return lines;
  }

  // ── Helpers ──

  /** Loads cart items with variant, watch, stock, categories and first image, priced at today's price. */
  private async lines(userId: string): Promise<CartLine[]> {
    const items = await this.items
      .repo()
      .createQueryBuilder('item')
      .innerJoin('item.cart', 'cart', 'cart.userId = :userId', { userId })
      .innerJoinAndSelect('item.variant', 'variant')
      .leftJoinAndSelect('variant.inventory', 'inventory')
      .innerJoinAndSelect('variant.watch', 'watch')
      .leftJoinAndSelect('watch.brand', 'brand')
      .leftJoinAndSelect('watch.categories', 'category')
      .leftJoinAndSelect('watch.images', 'image')
      .orderBy('item.createdAt', 'ASC')
      .getMany();

    return items.map((item) => this.toLine(item));
  }

  private toLine(item: CartItem): CartLine {
    const variant = item.variant!;
    const watch = variant.watch!;
    const available = variant.inventory?.availableQuantity ?? 0;
    const sellable = variant.isActive && watch.status === WatchStatusEnum.PUBLISHED && watch.brand?.isActive !== false;
    const firstImage = [...(watch.images ?? [])].sort((a, b) => a.position - b.position)[0];

    return {
      itemId: item.id,
      variantId: variant.id,
      watchId: watch.id,
      watchName: watch.name,
      watchSlug: watch.slug,
      sku: variant.sku,
      color: variant.color,
      imageId: firstImage?.id ?? null,
      categoryIds: (watch.categories ?? []).map((category) => category.id),
      unitPrice: variant.price,
      priceAtAdd: item.priceAtAdd,
      quantity: item.quantity,
      lineTotal: multiplyMoney(variant.price, item.quantity),
      availableQuantity: available,
      issue: !sellable ? 'unavailable' : available < item.quantity ? 'insufficient_stock' : null,
    };
  }

  private async purchasableVariant(variantId: string) {
    const variant = await this.variants.findOne({ where: { id: variantId }, options: { relations: { watch: true, inventory: true } } });
    if (!variant || !variant.isActive || variant.watch?.status !== WatchStatusEnum.PUBLISHED) throw new NotFoundException('This item is not available');
    return variant;
  }

  private assertQuantity(quantity: number, available: number) {
    if (quantity > MAX_QUANTITY_PER_ITEM) throw new BadRequestException(`You can buy up to ${MAX_QUANTITY_PER_ITEM} of each item`);
    if (quantity > available)
      throw new ConflictException({ message: 'Not enough stock for one or more items', code: 'OUT_OF_STOCK', availableQuantity: available });
  }

  private async findItem(userId: string, itemId: string): Promise<CartItem> {
    const item = await this.items
      .repo()
      .createQueryBuilder('item')
      .innerJoin('item.cart', 'cart', 'cart.userId = :userId', { userId })
      .where('item.id = :itemId', { itemId })
      .getOne();
    if (!item) throw new NotFoundException('Cart item not found');
    return item;
  }

  /** Gets the user's cart id, creating the cart on first use (safe under concurrent requests). */
  private async cartIdFor(userId: string): Promise<string> {
    await this.carts.repo().createQueryBuilder().insert().values({ userId }).orIgnore().execute();
    const cart = await this.carts.findOne({ where: { userId }, options: { select: { id: true } } });
    return cart!.id;
  }
}
