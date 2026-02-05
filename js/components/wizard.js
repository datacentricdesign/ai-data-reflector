// Wizard Navigation Component
import { appState } from '../state.js';

// Gibbs Reflective Cycle stages
const STEPS = ['description', 'feelings', 'evaluation', 'analysis', 'conclusion', 'action'];

let wizardSteps;
let wizardPanels;
let prevBtn;
let nextBtn;

export function initWizard() {
  // Get DOM elements
  wizardSteps = document.querySelectorAll('.wizard-step');
  wizardPanels = document.querySelectorAll('.wizard-panel');
  prevBtn = document.getElementById('prev-btn');
  nextBtn = document.getElementById('next-btn');

  // Set up navigation buttons
  prevBtn.addEventListener('click', goToPreviousStep);
  nextBtn.addEventListener('click', goToNextStep);

  // Make steps clickable (only completed steps)
  wizardSteps.forEach(step => {
    step.addEventListener('click', () => {
      const stepName = step.dataset.step;
      const stepIndex = STEPS.indexOf(stepName);
      const currentIndex = STEPS.indexOf(appState.currentStep);

      // Can only click on current or previous steps
      if (stepIndex <= currentIndex) {
        goToStep(stepName);
      }
    });
  });

  // Subscribe to state changes
  appState.subscribe(updateWizardUI);

  // Initial render
  updateWizardUI(appState.state);
}

function updateWizardUI(state) {
  const currentIndex = STEPS.indexOf(state.currentStep);

  // Update step indicators
  wizardSteps.forEach((step, index) => {
    const stepName = step.dataset.step;
    step.classList.remove('active', 'completed');

    if (stepName === state.currentStep) {
      step.classList.add('active');
    } else if (index < currentIndex) {
      step.classList.add('completed');
    }
  });

  // Update panels visibility
  wizardPanels.forEach(panel => {
    const panelName = panel.dataset.panel;
    panel.classList.toggle('hidden', panelName !== state.currentStep);
  });

  // Update navigation buttons
  prevBtn.disabled = currentIndex === 0;

  // Update next button text and state
  if (currentIndex === STEPS.length - 1) {
    nextBtn.textContent = 'Finish';
    nextBtn.disabled = true; // Can't go past action plan
  } else if (state.currentStep === 'description') {
    nextBtn.textContent = 'Next';
    // Disable next if no conversations imported
    nextBtn.disabled = state.conversations.length === 0;
  } else {
    nextBtn.textContent = 'Next';
    nextBtn.disabled = false;
  }
}

function goToPreviousStep() {
  const currentIndex = STEPS.indexOf(appState.currentStep);
  if (currentIndex > 0) {
    goToStep(STEPS[currentIndex - 1]);
  }
}

function goToNextStep() {
  const currentIndex = STEPS.indexOf(appState.currentStep);
  if (currentIndex < STEPS.length - 1) {
    goToStep(STEPS[currentIndex + 1]);
  }
}

export function goToStep(step) {
  if (STEPS.includes(step)) {
    appState.setStep(step);

    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Dispatch custom event for step change
    window.dispatchEvent(new CustomEvent('wizard-step-change', {
      detail: { step }
    }));
  }
}

// Check if we can proceed from current step
export function canProceed() {
  const state = appState.state;

  switch (state.currentStep) {
    case 'description':
      return state.conversations.length > 0;
    case 'feelings':
    case 'evaluation':
    case 'analysis':
    case 'conclusion':
      return true;
    case 'action':
      return false; // Can't proceed from last step
    default:
      return false;
  }
}
