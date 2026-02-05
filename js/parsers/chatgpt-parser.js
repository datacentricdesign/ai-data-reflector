// ChatGPT conversations.json Parser
// Handles the tree-based mapping structure from OpenAI exports

/**
 * Parse ChatGPT export file (conversations.json)
 * @param {Object|Array} json - Parsed JSON from conversations.json
 * @returns {Array} Normalized conversation objects
 */
export function parseChatGPT(json) {
  // Handle both array format and single conversation
  const conversations = Array.isArray(json) ? json : [json];
  const parsed = [];

  for (const conv of conversations) {
    try {
      const messages = extractMessagesFromMapping(conv.mapping, conv.current_node);

      // Skip conversations with no messages
      if (messages.length === 0) continue;

      parsed.push({
        id: conv.id || generateId(),
        platform: 'chatgpt',
        title: conv.title || inferTitle(messages) || 'Untitled',
        createdAt: conv.create_time ? new Date(conv.create_time * 1000).toISOString() : new Date().toISOString(),
        updatedAt: conv.update_time ? new Date(conv.update_time * 1000).toISOString() : new Date().toISOString(),
        messages: messages,
        messageCount: messages.length,
        wordCount: calculateWordCount(messages),
      });
    } catch (e) {
      console.warn('Failed to parse conversation:', e);
    }
  }

  return parsed;
}

/**
 * Extract messages from ChatGPT's tree-based mapping structure
 * Traverses from current_node backwards through parent references
 */
function extractMessagesFromMapping(mapping, currentNodeId) {
  if (!mapping || !currentNodeId) return [];

  const messages = [];
  let nodeId = currentNodeId;

  // Traverse backwards from current node
  while (nodeId && mapping[nodeId]) {
    const node = mapping[nodeId];

    if (node.message && node.message.content) {
      const role = node.message.author?.role;

      // Skip system messages
      if (role === 'system') {
        nodeId = node.parent;
        continue;
      }

      const content = extractContent(node.message.content);

      if (content && content.trim()) {
        messages.unshift({
          id: node.message.id || generateId(),
          role: normalizeRole(role),
          content: content,
          timestamp: node.message.create_time
            ? new Date(node.message.create_time * 1000).toISOString()
            : null,
          model: node.message.metadata?.model_slug || null
        });
      }
    }

    nodeId = node.parent;
  }

  return messages;
}

/**
 * Extract text content from ChatGPT's content structure
 */
function extractContent(content) {
  if (!content) return '';

  // Handle text content type
  if (content.content_type === 'text') {
    if (Array.isArray(content.parts)) {
      return content.parts.filter(p => typeof p === 'string').join('\n');
    }
    return content.parts || '';
  }

  // Handle multimodal_text content type
  if (content.content_type === 'multimodal_text') {
    if (Array.isArray(content.parts)) {
      return content.parts
        .filter(p => typeof p === 'string')
        .join('\n');
    }
  }

  // Handle code content type
  if (content.content_type === 'code') {
    return content.text || '';
  }

  // Handle execution_output content type
  if (content.content_type === 'execution_output') {
    return content.text || '';
  }

  return '';
}

/**
 * Normalize role names
 */
function normalizeRole(role) {
  const roleMap = {
    'user': 'user',
    'assistant': 'assistant',
    'tool': 'assistant',
  };
  return roleMap[role] || 'assistant';
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
  return 'conv_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Detect if JSON is ChatGPT format
 */
export function isChatGPTFormat(json) {
  if (Array.isArray(json)) {
    return json.length > 0 && json[0].mapping !== undefined;
  }
  return json.mapping !== undefined;
}
