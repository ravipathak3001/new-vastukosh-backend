/**
 * Shared helpers for the admin GraphQL surface (`*.admin.schema.ts` per module).
 *
 * Every admin list resolver follows the same shape: `page` (1-based) + `pageSize`
 * args in, a `{ items, total, page, pageSize }` object out. `resolvePaging`
 * clamps the inputs and derives the Mongo `skip` / `limit`; each module declares
 * its own `<Name>Page` object type (mirroring `ProductPageRef` in
 * `catalog.schema.ts`), exposing `total` / `page` / `pageSize` directly.
 */

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export type PageArgs = { page?: number | null; pageSize?: number | null };

export type Paged<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export function resolvePaging(args: PageArgs): {
  page: number;
  pageSize: number;
  skip: number;
  limit: number;
} {
  const page = Math.max(1, Math.trunc(args.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.trunc(args.pageSize ?? DEFAULT_PAGE_SIZE)),
  );
  return { page, pageSize, skip: (page - 1) * pageSize, limit: pageSize };
}

export function paged<T>(
  items: T[],
  total: number,
  { page, pageSize }: { page: number; pageSize: number },
): Paged<T> {
  return { items, total, page, pageSize };
}

/** Case-insensitive, regex-safe contains matcher for `search` filters. */
export function searchRegex(term: string): RegExp {
  return new RegExp(term.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}
