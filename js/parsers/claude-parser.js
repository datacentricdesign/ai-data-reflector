// Claude Export Parser
// Handles various Claude export formats

/**
 * Parse Claude export file
 * @param {Object|Array} json - Parsed JSON from Claude export
 * @returns {Array} Normalized conversation objects
 */
export function parseClaude(json) {
  const parsed = [];

  // Handle different possible structures
  let conversations = [];

  if (Array.isArray(json)) {
    conversations = json;
  } else if (json.conversations) {
    conversations = json.conversations;
  } else if (json.chat_messages || json.messages) {
    // Single conversation
    conversations = [json];
  } else {
    // Try to detect structure
    conversations = [json];
  }

  for (const conv of conversations) {
    try {
      const messages = parseClaudeMessages(conv);

      // Skip empty conversations
      if (messages.length === 0) continue;

      parsed.push({
        id: conv.uuid || conv.id || generateId(),
        platform: 'claude',
        title: conv.name || conv.title || inferTitle(messages) || 'Untitled',
        createdAt: parseClaudeDate(conv.created_at || conv.createdAt) || new Date().toISOString(),
        updatedAt: parseClaudeDate(conv.updated_at || conv.updatedAt) || new Date().toISOString(),
        messages: messages,
        messageCount: messages.length,
        wordCount: calculateWordCount(messages),
      });
    } catch (e) {
      console.warn('Failed to parse Claude conversation:', e);
    }
  }

  return parsed;
}

/**
 * Parse messages from Claude conversation
 */
function parseClaudeMessages(conv) {
  // Try different possible message locations
  const rawMessages = conv.chat_messages || conv.messages || conv.content || [];

  if (!Array.isArray(rawMessages)) {
    return [];
  }

  return rawMessages
    .map(msg => {
      const role = normalizeRole(msg.sender || msg.role || msg.author);
      const content = extractClaudeContent(msg);

      if (!content || !content.trim()) return null;

      return {
        id: msg.uuid || msg.id || generateId(),
        role: role,
        content: content,
        timestamp: parseClaudeDate(msg.created_at || msg.timestamp || msg.createdAt),
        model: msg.model || null
      };
    })
    .filter(msg => msg !== null);
}

/**
 * Extract content from Claude message
 * Handles various content structures
 */
function extractClaudeContent(msg) {
  // Simple string content
  if (typeof msg.text === 'string') {
    return msg.text;
  }

  if (typeof msg.content === 'string') {
    return msg.content;
  }

  // Array of content blocks
  if (Array.isArray(msg.content)) {
    return msg.content
      .map(block => {
        if (typeof block === 'string') return block;
        if (block.type === 'text') return block.text;
        if (block.type === 'tool_use') return `[Tool: ${block.name}]`;
        if (block.type === 'tool_result') return block.content || '';
        return '';
      })
      .filter(text => text)
      .join('\n');
  }

  // Content object with text property
  if (msg.content && typeof msg.content.text === 'string') {
    return msg.content.text;
  }

  // Message array (some export formats)
  if (Array.isArray(msg.message)) {
    return msg.message
      .map(m => m.text || m.content || '')
      .join('\n');
  }

  return '';
}

/**
 * Normalize role names from Claude format
 */
function normalizeRole(role) {
  if (!role) return 'assistant';

  const roleStr = String(role).toLowerCase();
  const roleMap = {
    'human': 'user',
    'user': 'user',
    'assistant': 'assistant',
    'ai': 'assistant',
    'claude': 'assistant',
    'bot': 'assistant'
  };

  return roleMap[roleStr] || 'assistant';
}

/**
 * Parse various date formats from Claude exports
 */
function parseClaudeDate(dateValue) {
  if (!dateValue) return null;

  // Already a valid date string
  if (typeof dateValue === 'string') {
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  // Unix timestamp (seconds)
  if (typeof dateValue === 'number') {
    // Check if it's seconds (10 digits) or milliseconds (13 digits)
    const timestamp = dateValue < 10000000000 ? dateValue * 1000 : dateValue;
    return new Date(timestamp).toISOString();
  }

  return null;
}

/**
 * Calculate total word count for messages
 */
function calculateWordCount(messages) {
  return messages.reduce((total, msg) => {
    const words = msg.content.trim().split(/\s+/).filter(w => w.length > 0);
    return total + words.length;
  }, 0);
}

/**
 * Infer title from first user message
 */
function inferTitle(messages) {
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (firstUserMessage) {
    const text = firstUserMessage.content.slice(0, 50);
    return text.length < firstUserMessage.content.length ? text + '...' : text;
  }
  return null;
}

/**
 * Generate a random ID
 */
function generateId() {
  return 'claude_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Detect if JSON is Claude format
 */
export function isClaudeFormat(json) {
  // Check for Claude-specific fields
  if (Array.isArray(json)) {
    if (json.length === 0) return false;
    const first = json[0];
    return (
      first.sender !== undefined ||
      first.chat_messages !== undefined ||
      (first.uuid !== undefined && first.mapping === undefined)
    );
  }

  return (
    json.chat_messages !== undefined ||
    json.sender !== undefined ||
    (json.uuid !== undefined && json.mapping === undefined) ||
    (json.conversations !== undefined && !json.mapping)
  );
}
