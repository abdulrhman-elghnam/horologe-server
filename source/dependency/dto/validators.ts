import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Reusable property decorators so DTOs stay short and consistent. */

export const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
export const trimUpper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);
const emptyToUndefined = ({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() === '' ? undefined : value);

const compose =
  (...decorators: PropertyDecorator[]): PropertyDecorator =>
  (target, key) =>
    decorators.forEach((decorator) => decorator(target, key));

/** Required, trimmed, non-empty string up to `max` characters. */
export const RequiredText = (max: number) => compose(Transform(trim), IsString(), IsNotEmpty(), MaxLength(max));

/** Optional trimmed string up to `max` characters. */
export const OptionalText = (max: number) => compose(IsOptional(), Transform(trim), IsString(), MaxLength(max));

/** Money amount: number >= 0 with at most two decimals. Query strings are converted. */
export const Money = () =>
  compose(
    Type(() => Number),
    IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false }),
    Min(0),
    Max(9_999_999),
  );

export const OptionalMoney = () => compose(IsOptional(), Transform(emptyToUndefined), Money());

/** Integer within [min, max]; query strings are converted. */
export const Int = (min: number, max: number) =>
  compose(
    Type(() => Number),
    IsInt(),
    Min(min),
    Max(max),
  );

export const OptionalInt = (min: number, max: number) => compose(IsOptional(), Transform(emptyToUndefined), Int(min, max));

/** Accepts true/false and the query-string forms "true"/"false". */
export const toBoolean = ({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value);
