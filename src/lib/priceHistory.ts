// Daily price snapshots for computing historical P&L on the calendar.
// Stored in localStorage as: { [yyyy-mm-dd]: { [key]: price } } where key = "stock:AAPL" or "crypto:bitcoin"

const KEY = "invest-price-history-v1";

export type PriceMap = Record<string, number>;
export type History = Record<string, PriceMap>; // date -> prices

const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toUtcTime(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function fromUtcTime(time: number): string {
  const d = new Date(time);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: string, days: number): string {
  return fromUtcTime(toUtcTime(date) + days * DAY_MS);
}

function read(): History {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
  catch { return {}; }
}
function write(h: History) {
  try { localStorage.setItem(KEY, JSON.stringify(h)); } catch { /* ignore */ }
}

export function recordSnapshot(prices: PriceMap) {
  if (!Object.keys(prices).length) return;
  const today = dateKey();
  const h = read();
  const earlierDates = Object.keys(h)
    .filter((date) => isIsoDate(date) && date < today)
    .sort();
  const previousDate = earlierDates[earlierDates.length - 1];

  if (previousDate) {
    let carry = { ...(h[previousDate] || {}) };
    for (let date = addDays(previousDate, 1); date < today; date = addDays(date, 1)) {
      if (h[date]) {
        carry = { ...carry, ...h[date] };
      } else {
        h[date] = { ...carry };
      }
    }
  }

  h[today] = { ...(h[today] || {}), ...prices };
  write(h);
}

export function getHistory(): History {
  return read();
}

export function clearHistory() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
