// Application State Management with localStorage persistence

const STORAGE_KEY = 'ai-reflector-state';

class AppState {
  constructor() {
    this._state = {
      currentStep: 'description',
      conversations: [],
      annotations: {},      // conversationId -> Annotation
      reflections: {},      // theme -> response
      importSources: [],    // { platform, filename, importedAt, count }
      deletedIds: [],       // IDs of conversations user explicitly deleted
    };
    this._listeners = new Set();
    this._restore();
  }

  get state() {
    return this._state;
  }

  get conversations() {
    return this._state.conversations;
  }

  get annotations() {
    return this._state.annotations;
  }

  get reflections() {
    return this._state.reflections;
  }

  get currentStep() {
    return this._state.currentStep;
  }

  // Subscribe to state changes
  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  // Notify all listeners
  _notify() {
    this._listeners.forEach(fn => fn(this._state));
  }

  // Update state and persist
  update(partial) {
    this._state = { ...this._state, ...partial };
    this._notify();
    this._persist();
  }

  // Set current wizard step
  setStep(step) {
    this.update({ currentStep: step });
  }

  // Add conversations from import (returns object with counts and previously deleted conversations)
  addConversations(conversations, source, options = {}) {
    const { includeDeleted = false } = options;
    const existing = this._state.conversations;
    const existingIds = new Set(existing.map(c => c.id));
    const deletedIds = new Set(this._state.deletedIds);

    // Separate conversations into categories
    const duplicates = [];
    const previouslyDeleted = [];
    const brandNew = [];

    conversations.forEach(conv => {
      if (existingIds.has(conv.id)) {
        duplicates.push(conv);
      } else if (deletedIds.has(conv.id) && !includeDeleted) {
        previouslyDeleted.push(conv);
      } else {
        brandNew.push(conv);
      }
    });

    // Add the new conversations
    const updatedSources = [
      ...this._state.importSources,
      {
        ...source,
        count: brandNew.length,
        importedAt: new Date().toISOString()
      }
    ];

    // If including previously deleted, remove them from deletedIds
    let updatedDeletedIds = this._state.deletedIds;
    if (includeDeleted && previouslyDeleted.length > 0) {
      const readdedIds = new Set(previouslyDeleted.map(c => c.id));
      updatedDeletedIds = this._state.deletedIds.filter(id => !readdedIds.has(id));
    }

    this.update({
      conversations: [...existing, ...brandNew],
      importSources: updatedSources,
      deletedIds: updatedDeletedIds
    });

    return {
      added: brandNew.length,
      duplicates: duplicates.length,
      previouslyDeleted
    };
  }

  // Get conversation by ID
  getConversation(id) {
    return this._state.conversations.find(c => c.id === id);
  }

  // Remove a conversation by ID
  removeConversation(id) {
    const conversations = this._state.conversations.filter(c => c.id !== id);

    // Also remove any annotation for this conversation
    const annotations = { ...this._state.annotations };
    delete annotations[id];

    // Track this ID as deleted so we don't auto-reimport it
    const deletedIds = [...this._state.deletedIds];
    if (!deletedIds.includes(id)) {
      deletedIds.push(id);
    }

    this.update({ conversations, annotations, deletedIds });
  }

  // Check which conversations were previously deleted
  getDeletedFromList(conversationIds) {
    const deletedSet = new Set(this._state.deletedIds);
    return conversationIds.filter(id => deletedSet.has(id));
  }

  // Restore previously deleted conversations (remove from deleted list)
  undeleteConversations(ids) {
    const deletedIds = this._state.deletedIds.filter(id => !ids.includes(id));
    this.update({ deletedIds });
  }

  // Set annotation for a conversation
  setAnnotation(conversationId, annotation) {
    const annotations = { ...this._state.annotations };
    annotations[conversationId] = {
      ...annotation,
      conversationId,
      updatedAt: new Date().toISOString()
    };
    this.update({ annotations });
  }

  // Get annotation for a conversation
  getAnnotation(conversationId) {
    return this._state.annotations[conversationId] || null;
  }

  // Set reflection for a theme
  setReflection(theme, response) {
    const reflections = { ...this._state.reflections };
    reflections[theme] = {
      theme,
      response,
      updatedAt: new Date().toISOString()
    };
    this.update({ reflections });
  }

  // Get reflection for a theme
  getReflection(theme) {
    return this._state.reflections[theme]?.response || '';
  }

  // Get statistics
  getStatistics() {
    const conversations = this._state.conversations;

    if (conversations.length === 0) {
      return null;
    }

    const byPlatform = { chatgpt: 0, claude: 0, copilot: 0 };
    const byMonth = {};
    const byDayOfWeek = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const byDate = {};

    let totalMessages = 0;
    let totalWords = 0;
    let earliest = null;
    let latest = null;

    conversations.forEach(conv => {
      // Platform
      byPlatform[conv.platform]++;

      // Messages and words
      totalMessages += conv.messageCount || 0;
      totalWords += conv.wordCount || 0;

      // Date stats
      const date = new Date(conv.createdAt);
      if (!earliest || date < earliest) earliest = date;
      if (!latest || date > latest) latest = date;

      // By month
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;

      // By day of week
      byDayOfWeek[date.getDay()]++;

      // By date (for heatmap)
      const dateKey = date.toISOString().split('T')[0];
      byDate[dateKey] = (byDate[dateKey] || 0) + 1;
    });

    // Annotation stats
    const annotatedCount = Object.keys(this._state.annotations).length;

    return {
      totalConversations: conversations.length,
      totalMessages,
      totalWords,
      earliest,
      latest,
      byPlatform,
      byMonth,
      byDayOfWeek,
      byDate,
      annotatedCount,
      annotationProgress: conversations.length > 0
        ? Math.round((annotatedCount / conversations.length) * 100)
        : 0
    };
  }

  // Clear all data
  clear() {
    this._state = {
      currentStep: 'description',
      conversations: [],
      annotations: {},
      reflections: {},
      importSources: [],
      deletedIds: []
    };
    this._notify();
    localStorage.removeItem(STORAGE_KEY);
  }

  // Export entire session as JSON
  exportSession() {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      currentStep: this._state.currentStep,
      conversations: this._state.conversations,
      annotations: this._state.annotations,
      reflections: this._state.reflections,
      importSources: this._state.importSources,
      deletedIds: this._state.deletedIds
    };
  }

  // Import session from JSON
  importSession(data) {
    // Validate version
    if (!data.version) {
      throw new Error('Invalid session file: missing version');
    }

    // Restore state
    this._state = {
      currentStep: data.currentStep || 'description',
      conversations: data.conversations || [],
      annotations: data.annotations || {},
      reflections: data.reflections || {},
      importSources: data.importSources || [],
      deletedIds: data.deletedIds || []
    };

    this._notify();
    this._persist();

    return {
      conversations: this._state.conversations.length,
      annotations: Object.keys(this._state.annotations).length,
      reflections: Object.keys(this._state.reflections).length
    };
  }

  // Merge a session with current data (keep existing annotations/reflections, add new conversations)
  mergeSession(data) {
    if (!data.version) {
      throw new Error('Invalid session file: missing version');
    }

    const existingIds = new Set(this._state.conversations.map(c => c.id));
    const newConversations = (data.conversations || []).filter(c => !existingIds.has(c.id));

    // Merge annotations (don't overwrite existing)
    const mergedAnnotations = { ...this._state.annotations };
    for (const [id, annotation] of Object.entries(data.annotations || {})) {
      if (!mergedAnnotations[id]) {
        mergedAnnotations[id] = annotation;
      }
    }

    // Merge reflections (don't overwrite existing non-empty)
    const mergedReflections = { ...this._state.reflections };
    for (const [theme, reflection] of Object.entries(data.reflections || {})) {
      if (!mergedReflections[theme] || !mergedReflections[theme].response) {
        mergedReflections[theme] = reflection;
      }
    }

    // Merge import sources
    const mergedSources = [
      ...this._state.importSources,
      ...(data.importSources || [])
    ];

    // Merge deleted IDs (union of both)
    const mergedDeletedIds = [...new Set([
      ...this._state.deletedIds,
      ...(data.deletedIds || [])
    ])];

    this.update({
      conversations: [...this._state.conversations, ...newConversations],
      annotations: mergedAnnotations,
      reflections: mergedReflections,
      importSources: mergedSources,
      deletedIds: mergedDeletedIds
    });

    return {
      newConversations: newConversations.length,
      totalConversations: this._state.conversations.length
    };
  }

  // Persist state to localStorage
  _persist() {
    try {
      const data = {
        currentStep: this._state.currentStep,
        conversations: this._state.conversations,
        annotations: this._state.annotations,
        reflections: this._state.reflections,
        importSources: this._state.importSources,
        deletedIds: this._state.deletedIds
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to persist state:', e);
    }
  }

  // Restore state from localStorage
  _restore() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        this._state = {
          currentStep: data.currentStep || 'description',
          conversations: data.conversations || [],
          annotations: data.annotations || {},
          reflections: data.reflections || {},
          importSources: data.importSources || [],
          deletedIds: data.deletedIds || []
        };
      }
    } catch (e) {
      console.warn('Failed to restore state:', e);
    }
  }
}

// Export singleton instance
export const appState = new AppState();
