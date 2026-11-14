import { Injectable } from '@nestjs/common';

import { SavedWatchListService } from '../shared/saved-watch-list.service.js';
import type { CompareItem } from '../../database/model/saved-watch.model.js';
import { CompareRepository } from '../../database/repository/compare.repository.js';
import { WatchRepository } from '../../database/repository/watch.repository.js';

/** Side-by-side comparison list; small on purpose so the comparison table stays readable. */
@Injectable()
export class CompareService extends SavedWatchListService<CompareItem> {
  protected readonly maxItems = 4;
  protected readonly listName = 'compare list';

  constructor(items: CompareRepository, watches: WatchRepository) {
    super(items, watches);
  }
}
