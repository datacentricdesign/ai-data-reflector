// Timeline Component - Visualization of AI usage patterns
import { appState } from '../state.js';
import {
  formatDateKey,
  formatDate,
  formatShortDate,
  getMonthName,
  formatMonthKey,
  getDateRange,
  getHeatmapStartDate,
  groupByDate,
  getMonthKeysInRange
} from '../utils/date-utils.js';

let statsCards;
let heatmapGrid;
let heatmapMonths;
let platformChart;
let monthlyChart;
let conversationList;
let searchInput;
let platformFilter;
let activeFilterEl;
let filterValueEl;
let filterClearBtn;
let currentDateFilter = null;

export function initTimeline() {
  // Get DOM elements
  statsCards = document.getElementById('stats-cards');
  heatmapGrid = document.getElementById('heatmap-grid');
  heatmapMonths = document.getElementById('heatmap-months');
  platformChart = document.getElementById('platform-chart');
  monthlyChart = document.getElementById('monthly-chart');
  conversationList = document.getElementById('conversation-list');
  searchInput = document.getElementById('conversation-search');
  platformFilter = document.getElementById('platform-filter');
  activeFilterEl = document.getElementById('active-filter');
  filterValueEl = document.getElementById('filter-value');
  filterClearBtn = document.getElementById('filter-clear');

  // Set up filters
  searchInput.addEventListener('input', filterConversations);
  platformFilter.addEventListener('change', filterConversations);

  // Set up clear filter button
  filterClearBtn.addEventListener('click', clearDateFilter);

  // Listen for step changes
  window.addEventListener('wizard-step-change', (e) => {
    if (e.detail.step === 'feelings') {
      renderTimeline();
    }
  });

  // Subscribe to state changes
  appState.subscribe((state) => {
    if (state.currentStep === 'feelings') {
      renderTimeline();
    }
  });
}

function renderTimeline() {
  const conversations = appState.conversations;

  if (conversations.length === 0) {
    showEmptyState();
    return;
  }

  renderStatsCards();
  renderHeatmap();
  renderPlatformChart();
  renderMonthlyChart();
  renderConversationList();
}

function showEmptyState() {
  statsCards.innerHTML = '<div class="empty-state">No data to display. Import your conversations first.</div>';
}

function renderStatsCards() {
  const stats = appState.getStatistics();

  statsCards.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${stats.totalConversations}</div>
      <div class="stat-label">Conversations</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.totalMessages.toLocaleString()}</div>
      <div class="stat-label">Messages</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${Math.round(stats.totalWords / 1000)}k</div>
      <div class="stat-label">Words</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${getMostActiveDay(stats.byDayOfWeek)}</div>
      <div class="stat-label">Most Active Day</div>
    </div>
  `;
}

function getMostActiveDay(byDayOfWeek) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let maxDay = 0;
  let maxCount = 0;

  Object.entries(byDayOfWeek).forEach(([day, count]) => {
    if (count > maxCount) {
      maxCount = count;
      maxDay = parseInt(day);
    }
  });

  return days[maxDay];
}

function renderHeatmap() {
  const conversations = appState.conversations;
  const byDate = groupByDate(conversations);

  // Calculate date range
  const end = new Date();
  const start = getHeatmapStartDate(conversations);

  // Adjust start to align with Sunday
  const alignedStart = new Date(start);
  alignedStart.setDate(alignedStart.getDate() - alignedStart.getDay());

  // Generate month labels
  const months = [];
  let currentMonth = alignedStart.getMonth();
  let weekCount = 0;

  const tempDate = new Date(alignedStart);
  while (tempDate <= end) {
    if (tempDate.getMonth() !== currentMonth) {
      currentMonth = tempDate.getMonth();
      months.push({ month: getMonthName(tempDate), week: weekCount });
    }
    tempDate.setDate(tempDate.getDate() + 7);
    weekCount++;
  }

  // Render month labels
  heatmapMonths.innerHTML = months.map(m =>
    `<span class="heatmap-month" style="grid-column: ${m.week + 1}">${m.month}</span>`
  ).join('');

  // Generate heatmap cells
  const dates = getDateRange(alignedStart, end);
  const maxCount = Math.max(...Object.values(byDate).map(arr => arr.length), 1);

  heatmapGrid.innerHTML = dates.map(date => {
    const key = formatDateKey(date);
    const count = byDate[key]?.length || 0;
    const level = getIntensityLevel(count, maxCount);
    const tooltip = `${formatDate(date)}: ${count} conversation${count !== 1 ? 's' : ''}`;

    return `<div class="heatmap-cell" data-date="${key}" data-level="${level}" data-count="${count}" title="${tooltip}"></div>`;
  }).join('');

  // Add click handlers
  heatmapGrid.querySelectorAll('.heatmap-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const date = cell.dataset.date;
      filterByDate(date);
    });
  });
}

function getIntensityLevel(count, maxCount) {
  if (count === 0) return 0;
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function renderPlatformChart() {
  const stats = appState.getStatistics();
  const chatgpt = stats.byPlatform.chatgpt || 0;
  const claude = stats.byPlatform.claude || 0;
  const total = chatgpt + claude;

  if (total === 0) {
    platformChart.innerHTML = '<div class="empty-state">No data</div>';
    return;
  }

  const chatgptPercent = Math.round((chatgpt / total) * 100);
  const claudePercent = 100 - chatgptPercent;

  // Create donut chart using SVG
  const chatgptAngle = (chatgpt / total) * 360;

  platformChart.innerHTML = `
    <svg class="donut-chart" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-claude)" stroke-width="20"/>
      <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-chatgpt)" stroke-width="20"
              stroke-dasharray="${chatgptAngle * 2.51} 1000"
              transform="rotate(-90 50 50)"/>
      <text x="50" y="50" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="var(--color-text)">
        ${total}
      </text>
      <text x="50" y="62" text-anchor="middle" font-size="6" fill="var(--color-text-muted)">total</text>
    </svg>
    <div class="platform-legend">
      ${chatgpt > 0 ? `
        <div class="legend-item">
          <div class="legend-color chatgpt"></div>
          <span>ChatGPT (${chatgpt} - ${chatgptPercent}%)</span>
        </div>
      ` : ''}
      ${claude > 0 ? `
        <div class="legend-item">
          <div class="legend-color claude"></div>
          <span>Claude (${claude} - ${claudePercent}%)</span>
        </div>
      ` : ''}
    </div>
  `;
}

function renderMonthlyChart() {
  const conversations = appState.conversations;
  const monthKeys = getMonthKeysInRange(conversations);

  if (monthKeys.length === 0) {
    monthlyChart.innerHTML = '<div class="empty-state">No data</div>';
    return;
  }

  // Count by month
  const byMonth = {};
  conversations.forEach(conv => {
    const date = new Date(conv.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    byMonth[key] = (byMonth[key] || 0) + 1;
  });

  const maxCount = Math.max(...Object.values(byMonth), 1);

  monthlyChart.innerHTML = monthKeys.map(key => {
    const count = byMonth[key] || 0;
    const height = Math.max((count / maxCount) * 150, count > 0 ? 10 : 0);
    const label = formatMonthKey(key).split(' ')[0]; // Just month name

    return `
      <div class="bar-wrapper">
        <div class="bar" style="height: ${height}px" data-count="${count}" data-month="${key}"></div>
        <span class="bar-label">${label}</span>
      </div>
    `;
  }).join('');
}

function renderConversationList(filter = {}) {
  let conversations = [...appState.conversations];

  // Apply search filter
  if (filter.search) {
    const query = filter.search.toLowerCase();
    conversations = conversations.filter(c =>
      c.title.toLowerCase().includes(query) ||
      c.messages.some(m => m.content.toLowerCase().includes(query))
    );
  }

  // Apply platform filter
  if (filter.platform && filter.platform !== 'all') {
    conversations = conversations.filter(c => c.platform === filter.platform);
  }

  // Apply date filter
  if (filter.date) {
    conversations = conversations.filter(c =>
      formatDateKey(c.createdAt) === filter.date
    );
  }

  // Sort by date (newest first)
  conversations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (conversations.length === 0) {
    conversationList.innerHTML = `
      <div class="empty-state">
        <p>No conversations found</p>
      </div>
    `;
    return;
  }

  conversationList.innerHTML = conversations.map(conv => {
    const date = new Date(conv.createdAt);
    const firstMessage = conv.messages.find(m => m.role === 'user')?.content || '';
    const preview = firstMessage.slice(0, 100) + (firstMessage.length > 100 ? '...' : '');

    return `
      <div class="conversation-item" data-id="${conv.id}">
        <div class="conversation-date">
          <span class="day">${date.getDate()}</span>
          <span class="month">${getMonthName(date)}</span>
        </div>
        <div class="conversation-info">
          <div class="conversation-title">${escapeHtml(conv.title)}</div>
          <div class="conversation-meta">
            <span class="platform-badge ${conv.platform}">${conv.platform === 'chatgpt' ? 'ChatGPT' : 'Claude'}</span>
            <span>${conv.messageCount} messages</span>
          </div>
          ${preview ? `<div class="conversation-preview">${escapeHtml(preview)}</div>` : ''}
        </div>
        <button class="conversation-delete" data-id="${conv.id}" title="Remove this conversation">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
        </button>
      </div>
    `;
  }).join('');

  // Add delete handlers
  conversationList.querySelectorAll('.conversation-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent selecting the conversation
      const id = btn.dataset.id;
      const conv = appState.getConversation(id);
      if (conv && confirm(`Remove "${conv.title}" from your data?\n\nThis cannot be undone.`)) {
        appState.removeConversation(id);
      }
    });
  });
}

function filterConversations() {
  const search = searchInput.value;
  const platform = platformFilter.value;

  // Clear date filter when using other filters
  if (search || platform !== 'all') {
    clearDateFilter(false);
  }

  renderConversationList({ search, platform, date: currentDateFilter });
}

function filterByDate(date) {
  // Toggle filter if clicking same date
  if (currentDateFilter === date) {
    clearDateFilter();
    return;
  }

  currentDateFilter = date;
  searchInput.value = '';
  platformFilter.value = 'all';

  // Show filter indicator
  const formattedDate = formatDate(date);
  filterValueEl.textContent = formattedDate;
  activeFilterEl.classList.remove('hidden');

  // Highlight selected cell in heatmap
  heatmapGrid.querySelectorAll('.heatmap-cell').forEach(cell => {
    cell.classList.toggle('selected', cell.dataset.date === date);
  });

  renderConversationList({ date });

  // Scroll to list
  conversationList.scrollIntoView({ behavior: 'smooth' });
}

function clearDateFilter(rerender = true) {
  currentDateFilter = null;
  activeFilterEl.classList.add('hidden');

  // Remove highlight from heatmap cells
  heatmapGrid.querySelectorAll('.heatmap-cell.selected').forEach(cell => {
    cell.classList.remove('selected');
  });

  if (rerender) {
    renderConversationList();
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
