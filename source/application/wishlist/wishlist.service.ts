import { Injectable } from '@nestjs/common';

import { SavedWatchListService } from '../shared/saved-watch-list.service.js';
import type { WishlistItem } from '../../database/model/saved-watch.model.js';
import { WatchRepository } from '../../database/repository/watch.repository.js';
import { WishlistRepository } from '../../database/repository/wishlist.repository.js';

@Injectable()
export class WishlistService extends SavedWatchListService<WishlistItem> {
  protected readonly maxItems = 100;
  protected readonly listName = 'wishlist';

  constructor(items: WishlistRepository, watches: WatchRepository) {
    super(items, watches);
  }
}
