// Microsoft Copilot Export Parser
// Handles exports from Microsoft's privacy data download (account.microsoft.com)

/**
 * Parse Microsoft Copilot export file
 * @param {Object|Array} json - Parsed JSON from Copilot export
 * @returns {Array} Normalized conversation objects
 */
export function parseCopilot(json) {
  // Format 1: Flat Q&A pairs grouped by ConversationId
  // { ConversationId, query, response, conversationTurnCreationDateTime, ... }
  if (Array.isArray(json) && json.length > 0 && hasFlatTurnStructure(json[0])) {
    return parseFlatTurns(json);
  }

  // Format 2: Message-per-row with Author/Body fields grouped by ConversationId
  // { ConversationId, Author, Body, Timestamp, ... }
  if (Array.isArray(json) && json.length > 0 && hasMessageRowStructure(json[0])) {
    return parseMessageRows(json);
  }

  // Format 3: Nested conversations with messages arrays
  // [ { id, messages: [{ author, text, timestamp }] } ]
  let conversations = [];
  if (Array.isArray(json)) {
    conversations = json;
  } else if (json.conversations) {
    conversations = json.conversations;
  } else {
    conversations = [json];
  }

  return parseNestedConversations(conversations);
}

/**
 * Check if a record is a flat Q&A turn (query/response pair)
 */
function hasFlatTurnStructure(record) {
  return (record.ConversationId !== undefined || record.conversationId !== undefined) &&
    (record.query !== undefined || record.Query !== undefined);
}

/**
 * Check if a record is a message-per-row format (Author/Body)
 */
function hasMessageRowStructure(record) {
  return (record.ConversationId !== undefined || record.conversationId !== undefined) &&
    (record.Author !== undefined || record.author !== undefined) &&
    (record.Body !== undefined || record.body !== undefined || record.Text !== undefined);
}

/**
 * Parse flat Q&A pairs format - each record has a query and response
 * Groups by ConversationId
 */
function parseFlatTurns(turns) {
  const convMap = new Map();

  for (const turn of turns) {
    const convId = turn.ConversationId || turn.conversationId || generateId();
    if (!convMap.has(convId)) {
      convMap.set(convId, []);
    }
    convMap.get(convId).push(turn);
  }

  const parsed = [];

  for (const [convId, convTurns] of convMap) {
    // Sort by timestamp
    convTurns.sort((a, b) => {
      const timeA = new Date(a.conversationTurnCreationDateTime || a.Timestamp || a.timestamp || 0).getTime();
      const timeB = new Date(b.conversationTurnCreationDateTime || b.Timestamp || b.timestamp || 0).getTime();
      return timeA - timeB;
    });

    const messages = [];

    for (const turn of convTurns) {
      const timestamp = parseCopilotDate(
        turn.conversationTurnCreationDateTime || turn.Timestamp || turn.timestamp
      );
      const userText = turn.query || turn.Query;
      const botText = turn.response || turn.Response;

      if (userText && userText.trim()) {
        messages.push({
          id: generateId(),
          role: 'user',
          content: userText.trim(),
          timestamp,
          model: null
        });
      }

      if (botText && botText.trim()) {
        messages.push({
          id: generateId(),
          role: 'assistant',
          content: botText.trim(),
          timestamp,
          model: turn.modelVersion || turn.model || null
        });
      }
    }

    if (messages.length === 0) continue;

    const createdAt = parseCopilotDate(
      convTurns[0].conversationTurnCreationDateTime || convTurns[0].Timestamp || convTurns[0].timestamp
    ) || new Date().toISOString();

    const updatedAt = parseCopilotDate(
      convTurns[convTurns.length - 1].conversationTurnCreationDateTime ||
      convTurns[convTurns.length - 1].Timestamp ||
      convTurns[convTurns.length - 1].timestamp
    ) || createdAt;

    parsed.push({
      id: 'copilot_' + sanitizeId(convId),
      platform: 'copilot',
      title: inferTitle(messages) || 'Copilot Conversation',
      createdAt,
      updatedAt,
      messages,
      messageCount: messages.length,
      wordCount: calculateWordCount(messages)
    });
  }

  return parsed;
}

/**
 * Parse message-per-row format - each record is a single message with Author/Body
 * Groups by ConversationId
 */
function parseMessageRows(rows) {
  const convMap = new Map();

  for (const row of rows) {
    const convId = row.ConversationId || row.conversationId || generateId();
    if (!convMap.has(convId)) {
      convMap.set(convId, []);
    }
    convMap.get(convId).push(row);
  }

  const parsed = [];

  for (const [convId, convRows] of convMap) {
    // Sort by timestamp
    convRows.sort((a, b) => {
      const timeA = new Date(a.Timestamp || a.timestamp || 0).getTime();
      const timeB = new Date(b.Timestamp || b.timestamp || 0).getTime();
      return timeA - timeB;
    });

    const messages = convRows
      .map(row => {
        const author = row.Author || row.author || '';
        const content = row.Body || row.body || row.Text || row.text || '';

        if (!content.trim()) return null;

        return {
          id: generateId(),
          role: normalizeRole(author),
          content: content.trim(),
          timestamp: parseCopilotDate(row.Timestamp || row.timestamp),
          model: null
        };
      })
      .filter(msg => msg !== null);

    if (messages.length === 0) continue;

    const createdAt = parseCopilotDate(
      convRows[0].Timestamp || convRows[0].timestamp
    ) || new Date().toISOString();

    const updatedAt = parseCopilotDate(
      convRows[convRows.length - 1].Timestamp || convRows[convRows.length - 1].timestamp
    ) || createdAt;

    parsed.push({
      id: 'copilot_' + sanitizeId(convId),
      platform: 'copilot',
      title: inferTitle(messages) || 'Copilot Conversation',
      createdAt,
      updatedAt,
      messages,
      messageCount: messages.length,
      wordCount: calculateWordCount(messages)
    });
  }

  return parsed;
}

/**
 * Parse nested conversations format - array of conversations with messages
 */
function parseNestedConversations(conversations) {
  const parsed = [];

  for (const conv of conversations) {
    try {
      const rawMessages = conv.messages || conv.turns || conv.chat_messages || [];

      if (!Array.isArray(rawMessages)) continue;

      const messages = rawMessages
        .map(msg => {
          const author = msg.author || msg.role || msg.Author || msg.sender || '';
          const content = msg.text || msg.body || msg.Body || msg.content || msg.Text || '';

          if (typeof content !== 'string' || !content.trim()) return null;

          return {
            id: msg.id || generateId(),
            role: normalizeRole(author),
            content: content.trim(),
            timestamp: parseCopilotDate(msg.timestamp || msg.Timestamp || msg.createdAt),
            model: msg.model || null
          };
        })
        .filter(msg => msg !== null);

      if (messages.length === 0) continue;

      const convId = conv.id || conv.conversationId || conv.ConversationId || generateId();
      const createdAt = parseCopilotDate(conv.createdAt || conv.created_at || conv.createDateTime || conv.Timestamp) ||
        messages[0]?.timestamp || new Date().toISOString();
      const updatedAt = parseCopilotDate(conv.updatedAt || conv.updated_at || conv.lastModifiedDateTime) ||
        messages[messages.length - 1]?.timestamp || createdAt;

      parsed.push({
        id: 'copilot_' + sanitizeId(String(convId)),
        platform: 'copilot',
        title: conv.title || conv.name || inferTitle(messages) || 'Copilot Conversation',
        createdAt,
        updatedAt,
        messages,
        messageCount: messages.length,
        wordCount: calculateWordCount(messages)
      });
    } catch (e) {
      console.warn('Failed to parse Copilot conversation:', e);
    }
  }

  return parsed;
}

/**
 * Normalize author/role names from Copilot format
 * Microsoft uses "User", "Bing", "Copilot", "bot" etc.
 */
function normalizeRole(role) {
  if (!role) return 'assistant';

  const roleStr = String(role).toLowerCase();
  const userRoles = new Set(['user', 'human', 'me']);
  const assistantRoles = new Set(['bing', 'copilot', 'bot', 'assistant', 'ai', 'microsoft copilot']);

  if (userRoles.has(roleStr)) return 'user';
  if (assistantRoles.has(roleStr)) return 'assistant';

  return 'assistant';
}

/**
 * Parse date values from Copilot exports
 */
function parseCopilotDate(dateValue) {
  if (!dateValue) return null;

  if (typeof dateValue === 'string') {
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  if (typeof dateValue === 'number') {
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
 * Sanitize a string to use as part of an ID
 */
function sanitizeId(str) {
  return str.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 24);
}

/**
 * Generate a random ID
 */
function generateId() {
  return 'copilot_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Detect if JSON is Microsoft Copilot format
 */
export function isCopilotFormat(json) {
  if (Array.isArray(json)) {
    if (json.length === 0) return false;
    const first = json[0];

    // Flat Q&A pairs format
    if ((first.ConversationId !== undefined || first.conversationId !== undefined) &&
        (first.query !== undefined || first.Query !== undefined)) {
      return true;
    }

    // Message-per-row format with Bing/Copilot author
    if ((first.ConversationId !== undefined || first.conversationId !== undefined) &&
        (first.Author !== undefined || first.author !== undefined)) {
      const author = String(first.Author || first.author || '').toLowerCase();
      if (author === 'bing' || author === 'copilot' || author === 'bot' ||
          author === 'user' || author === 'microsoft copilot') {
        return true;
      }
    }

    // Check for interactionType field (Microsoft Copilot specific)
    if (first.interactionType !== undefined && first.ConversationId !== undefined) {
      return true;
    }

    // Nested format with Microsoft-specific fields
    if (first.createDateTime !== undefined || first.lastModifiedDateTime !== undefined) {
      return true;
    }
  }

  // Object with conversations array and Microsoft-specific fields
  if (json.conversations !== undefined && Array.isArray(json.conversations)) {
    if (json.conversations.length > 0) {
      const firstConv = json.conversations[0];
      if (firstConv.createDateTime !== undefined || firstConv.lastModifiedDateTime !== undefined) {
        return true;
      }
    }
  }

  return false;
}
