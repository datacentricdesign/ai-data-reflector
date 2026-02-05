// Date utilities for timeline display

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Format date as YYYY-MM-DD
 */
export function formatDateKey(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Format date for display (e.g., "Jan 15, 2024")
 */
export function formatDate(date) {
  const d = new Date(date);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * Format date as month/day (e.g., "Jan 15")
 */
export function formatShortDate(date) {
  const d = new Date(date);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Get month name from date
 */
export function getMonthName(date) {
  return MONTHS[new Date(date).getMonth()];
}

/**
 * Get full month name from date
 */
export function getMonthNameFull(date) {
  return MONTHS_FULL[new Date(date).getMonth()];
}

/**
 * Get day name from date
 */
export function getDayName(date) {
  return DAYS[new Date(date).getDay()];
}

/**
 * Format month key (YYYY-MM) for display
 */
export function formatMonthKey(monthKey) {
  const [year, month] = monthKey.split('-');
  return `${MONTHS[parseInt(month, 10) - 1]} ${year}`;
}

/**
 * Get the start of a date range for heatmap (default: 1 year ago)
 */
export function getHeatmapStartDate(conversations) {
  if (!conversations || conversations.length === 0) {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 1);
    return date;
  }

  // Find earliest conversation
  const dates = conversations.map(c => new Date(c.createdAt));
  const earliest = new Date(Math.min(...dates));

  // Go back to the previous Sunday for alignment
  const start = new Date(earliest);
  start.setDate(start.getDate() - start.getDay());

  return start;
}

/**
 * Get all dates between start and end (inclusive)
 */
export function getDateRange(start, end) {
  const dates = [];
  const current = new Date(start);
  const endDate = new Date(end);

  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Group conversations by date key
 */
export function groupByDate(conversations) {
  const groups = {};

  conversations.forEach(conv => {
    const key = formatDateKey(conv.createdAt);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(conv);
  });

  return groups;
}

/**
 * Group conversations by month key (YYYY-MM)
 */
export function groupByMonth(conversations) {
  const groups = {};

  conversations.forEach(conv => {
    const date = new Date(conv.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(conv);
  });

  return groups;
}

/**
 * Get sorted month keys between conversations date range
 */
export function getMonthKeysInRange(conversations) {
  if (!conversations || conversations.length === 0) return [];

  const dates = conversations.map(c => new Date(c.createdAt));
  const earliest = new Date(Math.min(...dates));
  const latest = new Date(Math.max(...dates));

  const keys = [];
  const current = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  const end = new Date(latest.getFullYear(), latest.getMonth(), 1);

  while (current <= end) {
    const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    keys.push(key);
    current.setMonth(current.getMonth() + 1);
  }

  return keys;
}

/**
 * Format relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(date) {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Get date range text (e.g., "Jan 1 - Mar 15, 2024")
 */
export function formatDateRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);

  if (s.getFullYear() === e.getFullYear()) {
    if (s.getMonth() === e.getMonth()) {
      return `${MONTHS[s.getMonth()]} ${s.getDate()} - ${e.getDate()}, ${s.getFullYear()}`;
    }
    return `${MONTHS[s.getMonth()]} ${s.getDate()} - ${MONTHS[e.getMonth()]} ${e.getDate()}, ${s.getFullYear()}`;
  }

  return `${formatDate(s)} - ${formatDate(e)}`;
}
