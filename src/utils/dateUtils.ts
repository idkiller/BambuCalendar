export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

export function parseDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDisplayDate(str: string): string {
  const dt = parseDate(str);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}.${m}.${d} (${WEEKDAYS[dt.getDay()]})`;
}

export function formatShortDate(str: string): string {
  const dt = parseDate(str);
  return `${dt.getMonth() + 1}/${dt.getDate()} (${WEEKDAYS[dt.getDay()]})`;
}

export function daysBetween(startStr: string, endStr: string): number {
  const s = parseDate(startStr);
  const e = parseDate(endStr);
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
}

export function generateRoomId(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  for (let i = 0; i < arr.length; i++) {
    result += chars[arr[i] % chars.length];
  }
  return result;
}

export function buildRoomUrl(roomId: string): string {
  const url = new URL(window.location.href);
  url.search = `?room=${encodeURIComponent(roomId)}`;
  url.hash = '';
  return url.toString();
}
