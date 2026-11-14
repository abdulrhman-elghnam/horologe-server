import { Check, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';

import { BaseModel, MoneyColumn } from './base.model.js';
import { WatchVariant } from './watch-variant.model.js';

@Entity({ name: 'carts' })
export class Cart extends BaseModel {
  @Index({ unique: true })
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @OneToMany(() => CartItem, (item) => item.cart)
  items?: CartItem[];
}

@Entity({ name: 'cart_items' })
@Index(['cartId', 'variantId'], { unique: true })
@Check('CHK_cart_item_quantity_positive', '"quantity" > 0')
export class CartItem extends BaseModel {
  @Column({ name: 'cart_id', type: 'uuid' })
  cartId: string;

  @ManyToOne(() => Cart, (cart) => cart.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' })
  cart?: Cart;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId: string;

  @ManyToOne(() => WatchVariant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant?: WatchVariant;

  @Column({ type: 'int' })
  quantity: number;

  /** Price when the item was added; the live price is re-read at checkout. */
  @MoneyColumn({ name: 'price_at_add' })
  priceAtAdd: number;
}
