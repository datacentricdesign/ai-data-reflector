// Conclusion Component - Shows summary of previous stages
import { appState } from '../state.js';
import { getStageReflections, GIBBS_STAGES } from './reflection.js';

let journeySummary;

export function initConclusion() {
  journeySummary = document.getElementById('journey-summary');

  // Listen for step changes
  window.addEventListener('wizard-step-change', (e) => {
    if (e.detail.step === 'conclusion') {
      renderConclusion();
    }
  });

  // Subscribe to state changes
  appState.subscribe((state) => {
    if (state.currentStep === 'conclusion') {
      renderConclusion();
    }
  });
}

function renderConclusion() {
  if (!journeySummary) return;

  const stages = ['description', 'feelings', 'evaluation', 'analysis'];

  journeySummary.innerHTML = stages.map(stage => {
    const config = GIBBS_STAGES[stage];
    const reflections = getStageReflections(stage);

    let content;
    if (reflections.length === 0) {
      content = `<p class="no-data">Complete the ${config.name} reflection to see summary</p>`;
    } else {
      // Show a preview of reflections (first 150 chars of first response)
      const preview = reflections[0].answer.slice(0, 150) + (reflections[0].answer.length > 150 ? '...' : '');
      const moreCount = reflections.length - 1;

      content = `
        <div class="summary-preview">
          <p class="summary-text">${escapeHtml(preview)}</p>
          ${moreCount > 0 ? `<p class="summary-more">+ ${moreCount} more response${moreCount > 1 ? 's' : ''}</p>` : ''}
        </div>
      `;
    }

    return `
      <div class="summary-card ${reflections.length > 0 ? 'completed' : ''}">
        <h4>${config.name}</h4>
        <p class="summary-subtitle">${config.subtitle}</p>
        <div class="summary-content">
          ${content}
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
