import type { Column } from '@/components/DataTable';

export function getSortValue<T extends { id: string }>(row: T, col: Column<T>): string {
  if (col.sortValue) return String(col.sortValue(row));
  const rendered = col.render(row);
  if (typeof rendered === 'string' || typeof rendered === 'number') return String(rendered);
  const rowRec = row as unknown as Record<string, unknown>;
  if (col.key in rowRec) return String(rowRec[col.key] ?? '');
  return '';
}

export function getPaginationRange(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const range: number[] = [];
  if (current <= 4) {
    for (let i = 1; i <= 5; i++) range.push(i);
    range.push(-1);
    range.push(total);
  } else if (current >= total - 3) {
    range.push(1);
    range.push(-1);
    for (let i = total - 4; i <= total; i++) range.push(i);
  } else {
    range.push(1);
    range.push(-1);
    for (let i = current - 1; i <= current + 1; i++) range.push(i);
    range.push(-1);
    range.push(total);
  }
  return range;
}
