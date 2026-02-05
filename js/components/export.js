// Export Component - Generate and download reflection report
import { appState } from '../state.js';
import { generateMarkdown, markdownToHtml } from '../utils/markdown.js';

let exportPreview;
let copyBtn;
let downloadBtn;
let backupBtn;
let clearBtn;

export function initExport() {
  exportPreview = document.getElementById('export-preview');
  copyBtn = document.getElementById('copy-markdown-btn');
  downloadBtn = document.getElementById('download-btn');
  backupBtn = document.getElementById('export-backup-btn');
  clearBtn = document.getElementById('clear-session-btn');

  // Set up button handlers
  copyBtn.addEventListener('click', copyToClipboard);
  downloadBtn.addEventListener('click', downloadMarkdown);
  backupBtn.addEventListener('click', backupSession);
  clearBtn.addEventListener('click', clearSession);

  // Listen for step changes
  window.addEventListener('wizard-step-change', (e) => {
    if (e.detail.step === 'action') {
      renderExport();
    }
  });

  // Subscribe to state changes
  appState.subscribe((state) => {
    if (state.currentStep === 'action') {
      renderExport();
    }
  });
}

function renderExport() {
  const markdown = generateMarkdown();
  const html = markdownToHtml(markdown);

  exportPreview.innerHTML = html;

  // Store markdown for copy/download
  exportPreview.dataset.markdown = markdown;
}

async function copyToClipboard() {
  const markdown = exportPreview.dataset.markdown;

  try {
    await navigator.clipboard.writeText(markdown);
    showFeedback(copyBtn, 'Copied!');
  } catch (err) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = markdown;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
      showFeedback(copyBtn, 'Copied!');
    } catch (e) {
      showFeedback(copyBtn, 'Failed', true);
    }

    document.body.removeChild(textarea);
  }
}

function downloadMarkdown() {
  const markdown = exportPreview.dataset.markdown;
  const filename = `ai-reflection-${formatDateForFilename(new Date())}.md`;

  // Create blob and download
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);

  showFeedback(downloadBtn, 'Downloaded!');
}

function formatDateForFilename(date) {
  return date.toISOString().split('T')[0];
}

function backupSession() {
  const sessionData = appState.exportSession();
  const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const date = formatDateForFilename(new Date());
  const filename = `ai-reflector-session-${date}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);

  showFeedback(backupBtn, 'Downloaded!');
}

function clearSession() {
  const confirmed = confirm(
    'Are you sure you want to clear all data?\n\n' +
    'This will delete all imported conversations, annotations, and reflections.\n\n' +
    'This action cannot be undone. Consider backing up your session first.'
  );

  if (confirmed) {
    appState.clear();
    appState.setStep('description');
    window.location.reload();
  }
}

function showFeedback(btn, message, isError = false) {
  const originalBg = btn.style.backgroundColor;
  const originalHtml = btn.innerHTML;

  // Check if button has an SVG icon
  const svg = btn.querySelector('svg');
  if (svg) {
    btn.innerHTML = svg.outerHTML + ' ' + message;
  } else {
    btn.textContent = message;
  }
  btn.style.backgroundColor = isError ? 'var(--color-error)' : 'var(--color-success)';

  setTimeout(() => {
    btn.innerHTML = originalHtml;
    btn.style.backgroundColor = originalBg;
  }, 2000);
}
