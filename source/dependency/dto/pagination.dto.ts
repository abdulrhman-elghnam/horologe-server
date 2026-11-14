import { IsEnum, IsOptional } from 'class-validator';

import { SortOrderEnum } from '../value/database.enum.js';
import { OptionalInt, OptionalText } from './validators.js';

/** `?page=1&limit=20&sortBy=createdAt&sortOrder=desc` */
export class PaginationQueryDto {
  @OptionalInt(1, 10_000)
  page?: number = 1;

  @OptionalInt(1, 100)
  limit?: number = 20;

  /** Each list endpoint whitelists the fields it can sort by. */
  @OptionalText(40)
  sortBy?: string;

  @IsOptional()
  @IsEnum(SortOrderEnum)
  sortOrder?: SortOrderEnum = SortOrderEnum.DESC;
}

/** Picks a whitelisted SQL column for `sortBy`, falling back to `fallback`. */
export const sortColumn = (sortBy: string | undefined, allowed: Record<string, string>, fallback: string): string => (sortBy && allowed[sortBy]) || fallback;

export const sortDirection = (order: SortOrderEnum | undefined): 'ASC' | 'DESC' => (order === SortOrderEnum.ASC ? 'ASC' : 'DESC');
