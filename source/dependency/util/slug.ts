import { randomBytes } from 'node:crypto';

export const slugify = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9؀-ۿ]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'item';

/** Slug from `name`; adds a short random suffix when `isTaken` says it already exists. */
export const uniqueSlug = async (name: string, isTaken: (slug: string) => Promise<boolean>): Promise<string> => {
  const base = slugify(name);
  if (!(await isTaken(base))) return base;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}-${randomBytes(3).toString('hex')}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
};
