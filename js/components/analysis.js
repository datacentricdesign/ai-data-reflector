// Analysis Component - Shows annotation patterns and insights
import { appState } from '../state.js';
import { TAGS } from './annotations.js';
import { formatDate, groupByDate } from '../utils/date-utils.js';

let tagTimeline;
let tagTimelineLegend;
let tagSummary;
let ratingSummary;

export function initAnalysis() {
  // Get DOM elements
  tagTimeline = document.getElementById('tag-timeline');
  tagTimelineLegend = document.getElementById('tag-timeline-legend');
  tagSummary = document.getElementById('tag-summary');
  ratingSummary = document.getElementById('rating-summary');

  // Listen for step changes
  window.addEventListener('wizard-step-change', (e) => {
    if (e.detail.step === 'analysis') {
      renderAnalysis();
    }
  });

  // Subscribe to state changes
  appState.subscribe((state) => {
    if (state.currentStep === 'analysis') {
      renderAnalysis();
    }
  });
}

function renderAnalysis() {
  renderTagTimeline();
  renderTagSummary();
  renderRatingSummary();
}

function renderTagTimeline() {
  if (!tagTimeline) return;

  const conversations = [...appState.conversations];
  const annotations = appState.annotations;

  // Get annotated conversations sorted by date (oldest first for timeline)
  const annotatedConvs = conversations
    .filter(c => annotations[c.id] && annotations[c.id].tags && annotations[c.id].tags.length > 0)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  if (annotatedConvs.length === 0) {
    tagTimeline.innerHTML = `
      <div class="timeline-empty">Complete annotations in the Evaluation step to see patterns</div>
    `;
    if (tagTimelineLegend) tagTimelineLegend.innerHTML = '';
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
      <div class="timeline-bar" title="${escapeHtml(conv.title)}\n${date}\nTags: ${tags.map(t => TAGS.find(tag => tag.id === t)?.label || t).join(', ')}">
        ${dots}
      </div>
    `;
  }).join('');

  // Render legend for used tags only
  if (tagTimelineLegend) {
    const usedTagsList = TAGS.filter(tag => usedTags.has(tag.id));
    tagTimelineLegend.innerHTML = usedTagsList.map(tag => `
      <div class="legend-tag">
        <div class="tag-dot ${tag.id}"></div>
        <span>${tag.label}</span>
      </div>
    `).join('');
  }
}

function renderTagSummary() {
  if (!tagSummary) return;

  const annotations = appState.annotations;
  const tagCounts = {};

  // Count tags across all annotations
  Object.values(annotations).forEach(annotation => {
    (annotation.tags || []).forEach(tagId => {
      tagCounts[tagId] = (tagCounts[tagId] || 0) + 1;
    });
  });

  const totalTags = Object.values(tagCounts).reduce((a, b) => a + b, 0);

  if (totalTags === 0) {
    tagSummary.innerHTML = '<p class="no-data">Annotate conversations to see your tag distribution</p>';
    return;
  }

  // Sort tags by count (descending)
  const sortedTags = TAGS
    .filter(tag => tagCounts[tag.id])
    .sort((a, b) => (tagCounts[b.id] || 0) - (tagCounts[a.id] || 0));

  const maxCount = Math.max(...Object.values(tagCounts));

  tagSummary.innerHTML = `
    <div class="tag-bars">
      ${sortedTags.map(tag => {
        const count = tagCounts[tag.id];
        const percent = Math.round((count / maxCount) * 100);
        return `
          <div class="tag-bar-row">
            <span class="tag-bar-label">${tag.label}</span>
            <div class="tag-bar-container">
              <div class="tag-bar ${tag.id}" style="width: ${percent}%"></div>
            </div>
            <span class="tag-bar-count">${count}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderRatingSummary() {
  if (!ratingSummary) return;

  const annotations = appState.annotations;
  const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalRated = 0;
  let sumRatings = 0;

  // Count ratings
  Object.values(annotations).forEach(annotation => {
    if (annotation.rating) {
      ratingCounts[annotation.rating]++;
      totalRated++;
      sumRatings += annotation.rating;
    }
  });

  if (totalRated === 0) {
    ratingSummary.innerHTML = '<p class="no-data">Rate conversations to see your evaluation patterns</p>';
    return;
  }

  const avgRating = (sumRatings / totalRated).toFixed(1);
  const maxCount = Math.max(...Object.values(ratingCounts));

  ratingSummary.innerHTML = `
    <div class="rating-overview">
      <div class="avg-rating">
        <span class="avg-rating-value">${avgRating}</span>
        <span class="avg-rating-label">Average Rating</span>
      </div>
      <div class="rating-bars">
        ${[5, 4, 3, 2, 1].map(rating => {
          const count = ratingCounts[rating];
          const percent = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
          return `
            <div class="rating-bar-row">
              <span class="rating-bar-label">${rating} ★</span>
              <div class="rating-bar-container">
                <div class="rating-bar" style="width: ${percent}%"></div>
              </div>
              <span class="rating-bar-count">${count}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
    <p class="rating-summary-text">${totalRated} of ${appState.conversations.length} conversations rated</p>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
