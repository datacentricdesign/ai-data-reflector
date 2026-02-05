// Annotations Component - Tag and annotate conversations
import { appState } from '../state.js';
import { formatDate } from '../utils/date-utils.js';

// Predefined tags with metadata
const TAGS = [
  { id: 'productive', label: 'Productive', color: '#22c55e' },
  { id: 'learning-moment', label: 'Learning Moment', color: '#8b5cf6' },
  { id: 'over-reliance', label: 'Over-reliance', color: '#f59e0b' },
  { id: 'creative-boost', label: 'Creative Boost', color: '#ec4899' },
  { id: 'time-saver', label: 'Time Saver', color: '#06b6d4' },
  { id: 'confusion', label: 'Confusion', color: '#ef4444' },
  { id: 'breakthrough', label: 'Breakthrough', color: '#f59e0b' },
  { id: 'research-help', label: 'Research Help', color: '#3b82f6' },
  { id: 'writing-help', label: 'Writing Help', color: '#8b5cf6' },
  { id: 'coding-help', label: 'Coding Help', color: '#10b981' },
  { id: 'debugging', label: 'Debugging', color: '#f97316' },
  { id: 'brainstorming', label: 'Brainstorming', color: '#a855f7' }
];

// Shuffle array using Fisher-Yates algorithm (prevents ordering bias)
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

let annotationProgress;
let annotationList;
let annotationEditor;
let annotationFilter;
let tagTimeline;
let tagTimelineLegend;
let selectedConversationId = null;
let currentShuffledTags = null; // Cache shuffled order for current conversation

export function initAnnotations() {
  // Get DOM elements
  annotationProgress = document.getElementById('annotation-progress');
  annotationList = document.getElementById('annotation-list');
  annotationEditor = document.getElementById('annotation-editor');
  annotationFilter = document.getElementById('annotation-filter');
  tagTimeline = document.getElementById('tag-timeline');
  tagTimelineLegend = document.getElementById('tag-timeline-legend');

  // Set up filter
  annotationFilter.addEventListener('change', renderAnnotationList);

  // Listen for step changes
  window.addEventListener('wizard-step-change', (e) => {
    if (e.detail.step === 'evaluation') {
      renderAnnotations();
    }
  });

  // Subscribe to state changes
  appState.subscribe((state) => {
    if (state.currentStep === 'evaluation') {
      renderAnnotations();
    }
  });
}

function renderAnnotations() {
  renderTagTimeline();
  updateProgress();
  renderAnnotationList();

  // If a conversation was selected, re-render editor
  if (selectedConversationId) {
    renderEditor(selectedConversationId);
  }
}

function renderTagTimeline() {
  const conversations = [...appState.conversations];
  const annotations = appState.annotations;

  // Get annotated conversations sorted by date (oldest first for timeline)
  const annotatedConvs = conversations
    .filter(c => annotations[c.id] && annotations[c.id].tags && annotations[c.id].tags.length > 0)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  if (annotatedConvs.length === 0) {
    tagTimeline.innerHTML = `
      <div class="timeline-empty">Start annotating to see your patterns emerge</div>
    `;
    tagTimelineLegend.innerHTML = '';
    return;
  }

  // Track which tags are used for the legend
  const usedTags = new Set();

  // Render timeline bars (one per annotated conversation)
  tagTimeline.innerHTML = annotatedConvs.map(conv => {
    const annotation = annotations[conv.id];
    const tags = annotation.tags || [];
    const date = formatDate(conv.createdAt);

    // Track used tags
    tags.forEach(t => usedTags.add(t));

    // Create stacked dots for each tag
    const dots = tags.map(tagId => `<div class="tag-dot ${tagId}"></div>`).join('');

    return `
      <div class="timeline-bar" data-id="${conv.id}" title="${escapeHtml(conv.title)}\n${date}\nTags: ${tags.map(t => TAGS.find(tag => tag.id === t)?.label || t).join(', ')}">
        ${dots}
      </div>
    `;
  }).join('');

  // Add click handlers to timeline bars
  tagTimeline.querySelectorAll('.timeline-bar').forEach(bar => {
    bar.addEventListener('click', () => {
      selectConversation(bar.dataset.id);
      // Scroll the conversation into view in the list
      const listItem = annotationList.querySelector(`[data-id="${bar.dataset.id}"]`);
      if (listItem) {
        listItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });

  // Render legend for used tags only
  const usedTagsList = TAGS.filter(tag => usedTags.has(tag.id));
  tagTimelineLegend.innerHTML = usedTagsList.map(tag => `
    <div class="legend-tag">
      <div class="tag-dot ${tag.id}"></div>
      <span>${tag.label}</span>
    </div>
  `).join('');
}

function updateProgress() {
  const total = appState.conversations.length;
  const annotated = Object.keys(appState.annotations).length;
  const percent = total > 0 ? Math.round((annotated / total) * 100) : 0;

  annotationProgress.innerHTML = `
    <span class="progress-text">${annotated} of ${total} conversations annotated</span>
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${percent}%"></div>
    </div>
  `;
}

function renderAnnotationList() {
  const filter = annotationFilter.value;
  let conversations = [...appState.conversations];

  // Apply filter
  if (filter === 'annotated') {
    conversations = conversations.filter(c => appState.getAnnotation(c.id));
  } else if (filter === 'unannotated') {
    conversations = conversations.filter(c => !appState.getAnnotation(c.id));
  }

  // Sort by date (newest first)
  conversations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (conversations.length === 0) {
    annotationList.innerHTML = `
      <div class="empty-state" style="padding: 2rem; text-align: center; color: var(--color-text-muted);">
        No conversations to show
      </div>
    `;
    return;
  }

  annotationList.innerHTML = conversations.map(conv => {
    const isAnnotated = !!appState.getAnnotation(conv.id);
    const isSelected = conv.id === selectedConversationId;

    return `
      <div class="browser-item ${isAnnotated ? 'annotated' : ''} ${isSelected ? 'selected' : ''}"
           data-id="${conv.id}">
        <div class="browser-item-content">
          <div class="browser-item-title">${escapeHtml(conv.title)}</div>
          <div class="browser-item-meta">
            <span class="platform-badge ${conv.platform}">${conv.platform === 'chatgpt' ? 'GPT' : 'Claude'}</span>
            <span>${formatDate(conv.createdAt)}</span>
          </div>
        </div>
        <button class="browser-item-delete" data-id="${conv.id}" title="Remove">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
        </button>
      </div>
    `;
  }).join('');

  // Add click handlers
  annotationList.querySelectorAll('.browser-item').forEach(item => {
    item.addEventListener('click', (e) => {
      // Don't select if clicking delete button
      if (e.target.closest('.browser-item-delete')) return;
      selectConversation(item.dataset.id);
    });
  });

  // Add delete handlers
  annotationList.querySelectorAll('.browser-item-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const conv = appState.getConversation(id);
      if (conv && confirm(`Remove "${conv.title}" from your data?\n\nThis cannot be undone.`)) {
        // Clear selection if deleting selected conversation
        if (id === selectedConversationId) {
          selectedConversationId = null;
          annotationEditor.innerHTML = `
            <div class="no-selection">
              <p>Select a conversation to annotate</p>
            </div>
          `;
        }
        appState.removeConversation(id);
      }
    });
  });
}

function selectConversation(id) {
  // Only reshuffle tags when selecting a DIFFERENT conversation
  if (id !== selectedConversationId) {
    currentShuffledTags = shuffleArray(TAGS);
  }

  selectedConversationId = id;

  // Update list selection
  annotationList.querySelectorAll('.browser-item').forEach(item => {
    item.classList.toggle('selected', item.dataset.id === id);
  });

  renderEditor(id);
}

function renderEditor(conversationId) {
  const conversation = appState.getConversation(conversationId);

  if (!conversation) {
    annotationEditor.innerHTML = `
      <div class="no-selection">
        <p>Select a conversation to annotate</p>
      </div>
    `;
    return;
  }

  const annotation = appState.getAnnotation(conversationId) || {
    tags: [],
    notes: '',
    rating: null
  };

  // Get first few messages for preview
  const previewMessages = conversation.messages.slice(0, 4);

  annotationEditor.innerHTML = `
    <div class="editor-header">
      <div class="editor-title">${escapeHtml(conversation.title)}</div>
      <div class="editor-meta">
        <span class="platform-badge ${conversation.platform}">
          ${conversation.platform === 'chatgpt' ? 'ChatGPT' : 'Claude'}
        </span>
        <span>${formatDate(conversation.createdAt)}</span>
        <span>${conversation.messageCount} messages</span>
      </div>
    </div>

    <div class="conversation-preview-container">
      ${previewMessages.map(msg => `
        <div class="message-bubble ${msg.role}">
          <div class="message-role">${msg.role}</div>
          <div class="message-content">${escapeHtml(truncateText(msg.content, 200))}</div>
        </div>
      `).join('')}
      ${conversation.messages.length > 4 ? `
        <p style="text-align: center; color: var(--color-text-muted); font-size: var(--text-sm);">
          ... ${conversation.messages.length - 4} more messages
        </p>
      ` : ''}
    </div>

    <div class="tag-section">
      <h4>Tags</h4>
      <div class="tag-grid">
        ${(currentShuffledTags || TAGS).map(tag => `
          <button class="tag ${tag.id} ${annotation.tags.includes(tag.id) ? 'selected' : ''}"
                  data-tag="${tag.id}">
            ${tag.label}
          </button>
        `).join('')}
      </div>
    </div>

    <div class="rating-section">
      <h4>How helpful was this conversation? (1-5)</h4>
      <div class="star-rating">
        ${[1, 2, 3, 4, 5].map(n => `
          <span class="star ${annotation.rating >= n ? 'active' : ''}" data-rating="${n}">★</span>
        `).join('')}
      </div>
    </div>

    <div class="notes-section">
      <h4>Notes</h4>
      <textarea class="notes-textarea"
                placeholder="Add any notes about this conversation..."
                data-conversation-id="${conversationId}">${escapeHtml(annotation.notes)}</textarea>
    </div>

    <div class="auto-save-status" id="auto-save-status">
      <span class="status-text">Changes saved automatically</span>
    </div>
  `;

  // Set up event handlers with auto-save
  setupEditorHandlers(conversationId, annotation);
}

function setupEditorHandlers(conversationId, currentAnnotation) {
  const annotation = { ...currentAnnotation };
  let notesDebounceTimer = null;

  // Auto-save helper
  function autoSave() {
    // Get current notes value
    const notesEl = annotationEditor.querySelector('.notes-textarea');
    if (notesEl) {
      annotation.notes = notesEl.value;
    }

    // Save to state
    appState.setAnnotation(conversationId, annotation);

    // Update UI
    renderTagTimeline();
    updateProgress();
    renderAnnotationList();

    // Show save feedback
    showSaveStatus('Saved');
  }

  // Tag toggles - auto-save immediately
  annotationEditor.querySelectorAll('.tag').forEach(tagEl => {
    tagEl.addEventListener('click', () => {
      const tagId = tagEl.dataset.tag;
      const index = annotation.tags.indexOf(tagId);

      if (index === -1) {
        annotation.tags.push(tagId);
        tagEl.classList.add('selected');
      } else {
        annotation.tags.splice(index, 1);
        tagEl.classList.remove('selected');
      }

      autoSave();
    });
  });

  // Star rating - auto-save immediately
  annotationEditor.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', () => {
      const rating = parseInt(star.dataset.rating);
      annotation.rating = rating;

      // Update UI
      annotationEditor.querySelectorAll('.star').forEach((s, i) => {
        s.classList.toggle('active', i < rating);
      });

      autoSave();
    });

    // Hover effect
    star.addEventListener('mouseenter', () => {
      const rating = parseInt(star.dataset.rating);
      annotationEditor.querySelectorAll('.star').forEach((s, i) => {
        s.style.color = i < rating ? '#fbbf24' : '';
      });
    });

    star.addEventListener('mouseleave', () => {
      annotationEditor.querySelectorAll('.star').forEach((s) => {
        s.style.color = '';
      });
    });
  });

  // Notes textarea - debounced auto-save
  const notesTextarea = annotationEditor.querySelector('.notes-textarea');
  notesTextarea.addEventListener('input', () => {
    showSaveStatus('Saving...');

    // Clear previous timer
    clearTimeout(notesDebounceTimer);

    // Set new timer (save after 500ms of no typing)
    notesDebounceTimer = setTimeout(() => {
      autoSave();
    }, 500);
  });

  // Also save on blur (when clicking away)
  notesTextarea.addEventListener('blur', () => {
    clearTimeout(notesDebounceTimer);
    annotation.notes = notesTextarea.value;
    autoSave();
  });
}

function showSaveStatus(message) {
  const statusEl = document.getElementById('auto-save-status');
  if (!statusEl) return;

  const textEl = statusEl.querySelector('.status-text');
  textEl.textContent = message;

  statusEl.classList.add('visible');

  if (message === 'Saved') {
    statusEl.classList.add('saved');
    setTimeout(() => {
      statusEl.classList.remove('saved');
    }, 1500);
  } else {
    statusEl.classList.remove('saved');
  }
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Export tags for use in other components (original order preserved for markdown export)
export { TAGS };
