// Import Component - File upload and parsing
import { appState } from '../state.js';
import { parseChatGPT, isChatGPTFormat } from '../parsers/chatgpt-parser.js';
import { parseClaude, isClaudeFormat } from '../parsers/claude-parser.js';
import { parseCopilot, isCopilotFormat } from '../parsers/copilot-parser.js';
import { formatDate, formatDateRange } from '../utils/date-utils.js';

let uploadZone;
let fileInput;
let platformTabs;
let platformContents;
let importStatus;
let importStats;
let addMoreBtn;

// Session management elements
let backupSessionBtn;
let restoreSessionBtn;
let sessionFileInput;
let sessionWarning;
let confirmRestoreBtn;
let cancelRestoreBtn;
let mergeRestoreBtn;
let pendingSessionData = null;

// Pending deleted conversations for re-import prompt
let pendingDeletedConversations = null;
let pendingImportSource = null;

export function initImport() {
  // Get DOM elements
  uploadZone = document.getElementById('upload-zone');
  fileInput = document.getElementById('file-input');
  platformTabs = document.querySelectorAll('.platform-tab');
  platformContents = document.querySelectorAll('.platform-content');
  importStatus = document.getElementById('import-status');
  importStats = document.getElementById('import-stats');
  addMoreBtn = document.getElementById('add-more-btn');

  // Set up platform tabs
  platformTabs.forEach(tab => {
    tab.addEventListener('click', () => switchPlatform(tab.dataset.platform));
  });

  // Set up file upload
  setupFileUpload();

  // Set up add more button
  addMoreBtn.addEventListener('click', () => {
    importStatus.classList.add('hidden');
    uploadZone.classList.remove('hidden');
  });

  // Set up session management
  setupSessionManagement();

  // Subscribe to state changes
  appState.subscribe(updateImportUI);

  // Initial render
  updateImportUI(appState.state);
}

function setupSessionManagement() {
  backupSessionBtn = document.getElementById('backup-session-btn');
  restoreSessionBtn = document.getElementById('restore-session-btn');
  sessionFileInput = document.getElementById('session-file-input');
  sessionWarning = document.getElementById('session-warning');
  confirmRestoreBtn = document.getElementById('confirm-restore-btn');
  cancelRestoreBtn = document.getElementById('cancel-restore-btn');
  mergeRestoreBtn = document.getElementById('merge-restore-btn');

  // Backup session
  backupSessionBtn.addEventListener('click', () => {
    const sessionData = appState.exportSession();
    const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const date = new Date().toISOString().split('T')[0];
    const filename = `ai-reflector-session-${date}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
    showNotification('Session backup downloaded', 'success');
  });

  // Restore session - trigger file picker
  restoreSessionBtn.addEventListener('click', () => {
    sessionFileInput.click();
  });

  // Handle session file selection
  sessionFileInput.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      await handleSessionFile(files[0]);
    }
    sessionFileInput.value = '';
  });

  // Confirm replace
  confirmRestoreBtn.addEventListener('click', () => {
    if (pendingSessionData) {
      try {
        const result = appState.importSession(pendingSessionData);
        showNotification(`Session restored: ${result.conversations} conversations, ${result.annotations} annotations`, 'success');
      } catch (error) {
        showNotification(error.message, 'error');
      }
      pendingSessionData = null;
      sessionWarning.classList.add('hidden');
    }
  });

  // Cancel restore
  cancelRestoreBtn.addEventListener('click', () => {
    pendingSessionData = null;
    sessionWarning.classList.add('hidden');
  });

  // Merge instead of replace
  mergeRestoreBtn.addEventListener('click', () => {
    if (pendingSessionData) {
      try {
        const result = appState.mergeSession(pendingSessionData);
        showNotification(`Session merged: ${result.newConversations} new conversations added (${result.totalConversations} total)`, 'success');
      } catch (error) {
        showNotification(error.message, 'error');
      }
      pendingSessionData = null;
      sessionWarning.classList.add('hidden');
    }
  });

  // Set up deleted conversations prompt handlers
  const reimportDeletedBtn = document.getElementById('reimport-deleted-btn');
  const skipDeletedBtn = document.getElementById('skip-deleted-btn');
  const deletedPrompt = document.getElementById('deleted-conversations-prompt');

  reimportDeletedBtn.addEventListener('click', () => {
    if (pendingDeletedConversations && pendingImportSource) {
      // Re-import the deleted conversations
      const result = appState.addConversations(pendingDeletedConversations, pendingImportSource, { includeDeleted: true });
      showNotification(`Re-imported ${result.added} conversation${result.added !== 1 ? 's' : ''}`, 'success');
      updateImportUI(appState.state);
    }
    pendingDeletedConversations = null;
    pendingImportSource = null;
    deletedPrompt.classList.add('hidden');
  });

  skipDeletedBtn.addEventListener('click', () => {
    pendingDeletedConversations = null;
    pendingImportSource = null;
    deletedPrompt.classList.add('hidden');
  });
}

async function handleSessionFile(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Check if it's a session file
    if (!data.version) {
      throw new Error('This is not a valid session file. Please use "Add more data" to import AI conversation exports.');
    }

    // If there's existing data, show warning
    const hasExistingData = appState.conversations.length > 0 ||
                            Object.keys(appState.annotations).length > 0 ||
                            Object.keys(appState.reflections).length > 0;

    if (hasExistingData) {
      pendingSessionData = data;
      sessionWarning.classList.remove('hidden');
    } else {
      // No existing data, just import
      const result = appState.importSession(data);
      showNotification(`Session restored: ${result.conversations} conversations, ${result.annotations} annotations`, 'success');
    }
  } catch (error) {
    console.error('Session restore error:', error);
    showNotification(error.message || 'Failed to read session file', 'error');
  }
}

function switchPlatform(platform) {
  platformTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.platform === platform);
    tab.setAttribute('aria-selected', tab.dataset.platform === platform);
  });

  platformContents.forEach(content => {
    content.classList.toggle('hidden', content.dataset.platformContent !== platform);
  });
}

function setupFileUpload() {
  // Click to upload
  uploadZone.addEventListener('click', () => fileInput.click());

  // Drag and drop
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
  });

  uploadZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processFile(files[0]);
    }
  });

  // File input change
  fileInput.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      await processFile(files[0]);
    }
    // Reset input so same file can be selected again
    fileInput.value = '';
  });
}

async function processFile(file) {
  // Show loading state
  uploadZone.innerHTML = `
    <div class="upload-icon">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinning">
        <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32">
          <animate attributeName="stroke-dashoffset" dur="1s" values="32;0" repeatCount="indefinite"/>
        </circle>
      </svg>
    </div>
    <p class="upload-text">Processing ${file.name}...</p>
  `;

  try {
    const text = await file.text();
    const json = JSON.parse(text);

    let conversations = [];
    let platform = 'unknown';

    // Detect and parse format
    if (isChatGPTFormat(json)) {
      conversations = parseChatGPT(json);
      platform = 'chatgpt';
    } else if (isClaudeFormat(json)) {
      conversations = parseClaude(json);
      platform = 'claude';
    } else if (isCopilotFormat(json)) {
      conversations = parseCopilot(json);
      platform = 'copilot';
    } else {
      throw new Error('Unrecognized export format. Please upload a valid ChatGPT, Claude, or Microsoft Copilot export file.');
    }

    if (conversations.length === 0) {
      throw new Error('No conversations found in the file.');
    }

    // Add to state
    const result = appState.addConversations(conversations, {
      platform,
      filename: file.name
    });

    // Check if there are previously deleted conversations
    if (result.previouslyDeleted.length > 0) {
      // Store for later if user wants to re-import
      pendingDeletedConversations = result.previouslyDeleted;
      pendingImportSource = { platform, filename: file.name };
      showDeletedConversationsPrompt(result.previouslyDeleted);
    }

    // Show success
    showSuccess(platform, result.added, result.duplicates, result.previouslyDeleted.length);

  } catch (error) {
    console.error('Import error:', error);
    showError(error.message);
  }
}

function showDeletedConversationsPrompt(deletedConversations) {
  const deletedPrompt = document.getElementById('deleted-conversations-prompt');
  const deletedCount = document.getElementById('deleted-count');
  const deletedList = document.getElementById('deleted-list');

  deletedCount.textContent = `${deletedConversations.length} conversation${deletedConversations.length !== 1 ? 's were' : ' was'}`;

  // Show a preview of deleted conversation titles
  const previewCount = Math.min(3, deletedConversations.length);
  const titles = deletedConversations.slice(0, previewCount).map(c => c.title || 'Untitled');
  let listHtml = titles.map(t => `<li>${escapeHtml(t)}</li>`).join('');
  if (deletedConversations.length > previewCount) {
    listHtml += `<li>...and ${deletedConversations.length - previewCount} more</li>`;
  }
  deletedList.innerHTML = listHtml;

  deletedPrompt.classList.remove('hidden');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showSuccess(platform, addedCount, duplicateCount = 0, deletedCount = 0) {
  // Restore upload zone
  resetUploadZone();

  // Update stats
  updateImportUI(appState.state);

  // Show status if new conversations were added
  if (addedCount > 0) {
    const platformName = platform === 'chatgpt' ? 'ChatGPT' : platform === 'claude' ? 'Claude' : 'Microsoft Copilot';
    let message = `Successfully imported ${addedCount} conversation${addedCount !== 1 ? 's' : ''} from ${platformName}`;

    const skippedParts = [];
    if (duplicateCount > 0) {
      skippedParts.push(`${duplicateCount} duplicate${duplicateCount !== 1 ? 's' : ''}`);
    }
    if (deletedCount > 0) {
      skippedParts.push(`${deletedCount} previously deleted`);
    }
    if (skippedParts.length > 0) {
      message += ` (${skippedParts.join(', ')} skipped)`;
    }

    // Show a brief notification
    showNotification(message, 'success');
  } else if (deletedCount > 0) {
    showNotification(`No new conversations imported (${deletedCount} previously deleted conversation${deletedCount !== 1 ? 's' : ''} found)`, 'info');
  } else {
    showNotification('All conversations were already imported', 'info');
  }
}

function showError(message) {
  resetUploadZone();
  showNotification(message, 'error');
}

function resetUploadZone() {
  uploadZone.innerHTML = `
    <div class="upload-icon">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    </div>
    <p class="upload-text">Drag and drop your export file here</p>
    <p class="upload-subtext">or click to browse</p>
  `;
}

function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <span>${message}</span>
    <button class="notification-close">&times;</button>
  `;

  // Add styles if not already present
  if (!document.getElementById('notification-styles')) {
    const styles = document.createElement('style');
    styles.id = 'notification-styles';
    styles.textContent = `
      .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 16px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        animation: slideIn 0.3s ease;
      }
      .notification-success { background: #22c55e; color: white; }
      .notification-error { background: #ef4444; color: white; }
      .notification-info { background: #6366f1; color: white; }
      .notification-close {
        background: none;
        border: none;
        color: inherit;
        font-size: 20px;
        cursor: pointer;
        opacity: 0.8;
      }
      .notification-close:hover { opacity: 1; }
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(styles);
  }

  document.body.appendChild(notification);

  // Close button
  notification.querySelector('.notification-close').addEventListener('click', () => {
    notification.remove();
  });

  // Auto remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 5000);
}

function updateImportUI(state) {
  const hasConversations = state.conversations.length > 0;

  if (hasConversations) {
    // Show import status
    importStatus.classList.remove('hidden');

    // Calculate stats
    const stats = appState.getStatistics();
    const chatgptCount = stats.byPlatform.chatgpt || 0;
    const claudeCount = stats.byPlatform.claude || 0;
    const copilotCount = stats.byPlatform.copilot || 0;

    importStats.innerHTML = `
      <div class="import-stat">
        <span class="import-stat-value">${state.conversations.length}</span>
        <span class="import-stat-label">Total Conversations</span>
      </div>
      ${chatgptCount > 0 ? `
        <div class="import-stat">
          <span class="import-stat-value">${chatgptCount}</span>
          <span class="import-stat-label">ChatGPT</span>
        </div>
      ` : ''}
      ${claudeCount > 0 ? `
        <div class="import-stat">
          <span class="import-stat-value">${claudeCount}</span>
          <span class="import-stat-label">Claude</span>
        </div>
      ` : ''}
      ${copilotCount > 0 ? `
        <div class="import-stat">
          <span class="import-stat-value">${copilotCount}</span>
          <span class="import-stat-label">Copilot</span>
        </div>
      ` : ''}
      <div class="import-stat">
        <span class="import-stat-value">${stats.totalMessages.toLocaleString()}</span>
        <span class="import-stat-label">Messages</span>
      </div>
      <div class="import-stat">
        <span class="import-stat-value">${formatDateRange(stats.earliest, stats.latest)}</span>
        <span class="import-stat-label">Date Range</span>
      </div>
    `;

    // Hide upload zone but keep it available via "Add more" button
    uploadZone.classList.add('hidden');
  } else {
    importStatus.classList.add('hidden');
    uploadZone.classList.remove('hidden');
  }
}
