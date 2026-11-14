import type { Watch } from '../../database/model/watch.model.js';
import type { WatchImage } from '../../database/model/watch-image.model.js';
import type { WatchVariant } from '../../database/model/watch-variant.model.js';
import { SignedUrl } from '../../dependency/presenter.js';

export const presentImage = (image: WatchImage) => ({
  id: image.id,
  url: SignedUrl.sign('image', image.id),
  alt: image.alt,
  position: image.position,
});

export const presentVariant = (variant: WatchVariant, { admin = false } = {}) => {
  const { inventory, watch: _watch, ...rest } = variant;
  const available = inventory?.availableQuantity ?? 0;
  return {
    ...rest,
    inStock: available > 0,
    availableQuantity: available,
    ...(admin && inventory ? { reservedQuantity: inventory.reservedQuantity, lowStockThreshold: inventory.lowStockThreshold } : {}),
  };
};

/** Shapes a watch for the API: signed image URLs, stock flags on variants, inactive variants hidden from shoppers. */
export const presentWatch = (watch: Watch, { admin = false } = {}) => {
  const { images, variants, ...rest } = watch;
  return {
    ...rest,
    images: images ? [...images].sort((a, b) => a.position - b.position).map(presentImage) : undefined,
    variants: variants
      ? variants
          .filter((variant) => admin || variant.isActive)
          .sort((a, b) => a.price - b.price)
          .map((variant) => presentVariant(variant, { admin }))
      : undefined,
  };
};
