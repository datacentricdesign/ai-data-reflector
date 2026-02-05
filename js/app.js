// Main Application Entry Point
import { appState } from './state.js';
import { initWizard } from './components/wizard.js';
import { initImport } from './components/import.js';
import { initTimeline } from './components/timeline.js';
import { initAnnotations } from './components/annotations.js';
import { initReflection } from './components/reflection.js';
import { initAnalysis } from './components/analysis.js';
import { initConclusion } from './components/conclusion.js';
import { initExport } from './components/export.js';

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('AI Data Reflector initializing...');

  // Initialize all components
  initWizard();
  initImport();
  initTimeline();
  initAnnotations();
  initReflection();
  initAnalysis();
  initConclusion();
  initExport();

  // Subscribe to state changes for debugging
  appState.subscribe((state) => {
    console.log('State updated:', {
      step: state.currentStep,
      conversations: state.conversations.length,
      annotations: Object.keys(state.annotations).length
    });
  });

  // If we have existing data, show appropriate step
  if (appState.conversations.length > 0) {
    // Keep current step from restored state
    console.log(`Restored ${appState.conversations.length} conversations`);
  }

  console.log('AI Data Reflector initialized');
});
