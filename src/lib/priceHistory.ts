// Daily price snapshots for computing historical P&L on the calendar.
// Stored in localStorage as: { [yyyy-mm-dd]: { [key]: price } } where key = "stock:AAPL" or "crypto:bitcoin"

const KEY = "invest-price-history-v1";

export type PriceMap = Record<string, number>;
export type History = Record<string, PriceMap>; // date -> prices

function read(): History {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
  catch { return {}; }
}
function write(h: History) {
  try { localStorage.setItem(KEY, JSON.stringify(h)); } catch { /* ignore */ }
}

export function recordSnapshot(prices: PriceMap) {
  if (!Object.keys(prices).length) return;
  const today = new Date().toISOString().slice(0, 10);
  const h = read();
  h[today] = { ...(h[today] || {}), ...prices };
  write(h);
}

export function getHistory(): History {
  return read();
}

export function clearHistory() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
