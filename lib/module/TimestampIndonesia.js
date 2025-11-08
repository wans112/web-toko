// Helper to produce timestamps in Indonesia (WIB, Asia/Jakarta, UTC+7)
// Exports functions to get current time formatted for SQL (YYYY-MM-DD HH:mm:ss)
function pad(n) {
  return String(n).padStart(2, '0');
}

export function formatDateToSQL(date = new Date(), timeZone = 'Asia/Jakarta') {
  // Use toLocaleString with sv-SE (year-month-day) and the target timezone
  // Node supports timeZone in Intl options; this produces a string like 'YYYY-MM-DD HH:MM:SS'
  try {
    const opts = { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    // Use sv-SE locale to get ISO-like ordering
    const str = date.toLocaleString('sv-SE', opts);
    // toLocaleString with sv-SE returns 'YYYY-MM-DD HH:MM:SS' already; ensure consistent separator
    return str.replace('T', ' ');
  } catch (e) {
    // Fallback: compute using UTC offset for WIB (+7)
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const wib = new Date(utc + 7 * 3600000);
    return `${wib.getFullYear()}-${pad(wib.getMonth() + 1)}-${pad(wib.getDate())} ${pad(wib.getHours())}:${pad(wib.getMinutes())}:${pad(wib.getSeconds())}`;
  }
}

export function nowWIBForSQL() {
  return formatDateToSQL(new Date(), 'Asia/Jakarta');
}

export default {
  formatDateToSQL,
  nowWIBForSQL
};
