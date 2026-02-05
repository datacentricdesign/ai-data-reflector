// Reflection Component - Handles stage-based reflection prompts
// Each Gibbs stage has embedded reflection questions that are saved to state
import { appState } from '../state.js';

// Gibbs stages with their reflection questions
const GIBBS_STAGES = {
  description: {
    name: 'Description',
    subtitle: 'What happened?',
    questions: [
      { id: 'tools-purposes', label: 'Which AI tools did you use and for what purposes?' },
      { id: 'frequency', label: 'How would you describe your usage frequency?' },
      { id: 'task-types', label: 'What types of tasks did you delegate to AI?' }
    ]
  },
  feelings: {
    name: 'Feelings',
    subtitle: 'What were you thinking and feeling?',
    questions: [
      { id: 'overall-feelings', label: 'How did using AI make you feel overall?' },
      { id: 'heavy-use-feelings', label: 'How did periods of heavy use feel?' },
      { id: 'authenticity-feelings', label: 'How did you feel about authenticity of AI-assisted work?' },
      { id: 'should-feelings', label: 'When did you feel you should/shouldn\'t use AI?' }
    ]
  },
  evaluation: {
    name: 'Evaluation',
    subtitle: 'What was good and bad?',
    questions: [
      { id: 'most-valuable', label: 'Which interactions were most valuable?' },
      { id: 'least-helpful', label: 'Which interactions were least helpful?' },
      { id: 'time-impact', label: 'When did AI save or waste time?' },
      { id: 'errors-found', label: 'What errors did you find in AI outputs?' }
    ]
  },
  analysis: {
    name: 'Analysis',
    subtitle: 'What sense can you make of this?',
    questions: [
      { id: 'patterns-noticed', label: 'What patterns do you notice in your tags?' },
      { id: 'strategies-developed', label: 'What strategies did you develop?' },
      { id: 'learning-impact', label: 'How did AI affect your learning?' },
      { id: 'broader-costs', label: 'What are the broader costs of AI usage?' }
    ]
  },
  conclusion: {
    name: 'Conclusion',
    subtitle: 'What else could you have done?',
    questions: [
      { id: 'alternatives', label: 'What alternatives to AI existed?' },
      { id: 'should-shouldnt', label: 'When should you have used AI more or less?' },
      { id: 'skill-development', label: 'What skills might you have developed differently?' },
      { id: 'peer-advice', label: 'What would you tell a peer?' }
    ]
  },
  action: {
    name: 'Action Plan',
    subtitle: 'How will you approach AI going forward?',
    questions: [
      { id: 'guidelines', label: 'What personal guidelines will you set?' },
      { id: 'not-use-ai', label: 'When will you choose NOT to use AI?' },
      { id: 'skill-maintenance', label: 'How will you maintain your own skills?' },
      { id: 'stay-informed', label: 'How will you stay informed as AI evolves?' }
    ]
  }
};

// Track which textareas have handlers attached
const initializedTextareas = new WeakSet();

// Store debounce timers by textarea key
const saveTimers = new Map();

export function initReflection() {
  // Set up handlers for all reflection textareas across all steps
  setupReflectionHandlers();

  // Listen for step changes to set up handlers for newly visible textareas
  window.addEventListener('wizard-step-change', () => {
    // Small delay to let DOM update
    setTimeout(setupReflectionHandlers, 100);
  });
}

function setupReflectionHandlers() {
  // Find all reflection textareas with data-stage and data-question attributes
  document.querySelectorAll('.reflection-textarea[data-stage][data-question]').forEach(textarea => {
    // Skip if already initialized - don't touch it at all to preserve focus
    if (initializedTextareas.has(textarea)) {
      return;
    }

    const stage = textarea.dataset.stage;
    const question = textarea.dataset.question;
    const key = `${stage}.${question}`;

    // Load saved value only on first initialization
    const savedValue = appState.getReflection(key);
    if (savedValue && !textarea.value) {
      textarea.value = savedValue;
    }

    // Set up debounced save on input
    textarea.addEventListener('input', () => {
      // Clear any existing timer for this key
      if (saveTimers.has(key)) {
        clearTimeout(saveTimers.get(key));
      }

      // Set new timer - save after 1 second of no typing
      const timer = setTimeout(() => {
        appState.setReflection(key, textarea.value);
        saveTimers.delete(key);
      }, 1000);

      saveTimers.set(key, timer);
    });

    // Save on blur (when user clicks away)
    textarea.addEventListener('blur', () => {
      // Clear any pending timer
      if (saveTimers.has(key)) {
        clearTimeout(saveTimers.get(key));
        saveTimers.delete(key);
      }
      // Save immediately
      appState.setReflection(key, textarea.value);
    });

    // Mark as initialized
    initializedTextareas.add(textarea);
  });
}

// Get all reflections for a specific stage
export function getStageReflections(stage) {
  const stageConfig = GIBBS_STAGES[stage];
  if (!stageConfig) return [];

  return stageConfig.questions.map(q => ({
    question: q.label,
    answer: appState.getReflection(`${stage}.${q.id}`) || ''
  })).filter(r => r.answer.trim());
}

// Get all reflections across all stages
export function getAllReflections() {
  const result = {};

  Object.entries(GIBBS_STAGES).forEach(([stage, config]) => {
    result[stage] = {
      name: config.name,
      subtitle: config.subtitle,
      reflections: getStageReflections(stage)
    };
  });

  return result;
}

// Check if a stage has any reflections
export function hasStageReflections(stage) {
  return getStageReflections(stage).length > 0;
}

// Count total reflections
export function countReflections() {
  let count = 0;
  Object.keys(GIBBS_STAGES).forEach(stage => {
    count += getStageReflections(stage).length;
  });
  return count;
}

// Export for use in other components
export { GIBBS_STAGES };
