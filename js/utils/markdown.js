// Markdown generation utilities
import { appState } from '../state.js';
import { formatDate, formatDateRange } from './date-utils.js';
import { TAGS } from '../components/annotations.js';
import { getAllReflections } from '../components/reflection.js';

/**
 * Generate the complete markdown export
 */
export function generateMarkdown() {
  const stats = appState.getStatistics();
  const conversations = appState.conversations;
  const annotations = appState.annotations;

  const sections = [
    generateHeader(),
    generateSummary(stats),
    generateReflections(),
    generateAnnotatedConversations(conversations, annotations),
    generateFooter()
  ];

  return sections.join('\n\n');
}

function generateHeader() {
  const today = formatDate(new Date());

  return `# AI Usage Reflection Report
## Based on Gibbs' Reflective Cycle

**Generated**: ${today}
**Tool**: AI Data Reflector
**Framework**: Gibbs' Reflective Cycle × AI Literacy

---`;
}

function generateSummary(stats) {
  if (!stats) {
    return `## Usage Summary

No data available.`;
  }

  const chatgptCount = stats.byPlatform.chatgpt || 0;
  const claudeCount = stats.byPlatform.claude || 0;
  const dateRange = stats.earliest && stats.latest
    ? formatDateRange(stats.earliest, stats.latest)
    : 'N/A';

  return `## Usage Summary

| Metric | Value |
|--------|-------|
| Total Conversations | ${stats.totalConversations} |
| ChatGPT Conversations | ${chatgptCount} |
| Claude Conversations | ${claudeCount} |
| Total Messages | ${stats.totalMessages.toLocaleString()} |
| Approximate Word Count | ${stats.totalWords.toLocaleString()} |
| Date Range | ${dateRange} |
| Conversations Annotated | ${stats.annotatedCount} (${stats.annotationProgress}%) |`;
}

function generateReflections() {
  const allReflections = getAllReflections();

  const stageOrder = ['description', 'feelings', 'evaluation', 'analysis', 'conclusion', 'action'];
  const stageIcons = {
    description: '📋',
    feelings: '💭',
    evaluation: '⚖️',
    analysis: '🔍',
    conclusion: '💡',
    action: '🎯'
  };

  const reflectionSections = stageOrder.map(stageId => {
    const stage = allReflections[stageId];

    if (!stage || stage.reflections.length === 0) {
      return `### ${stageIcons[stageId]} ${stage.name}: ${stage.subtitle}

*No reflection provided.*`;
    }

    const responses = stage.reflections.map(r => {
      return `**${r.question}**

${r.answer}`;
    }).join('\n\n');

    return `### ${stageIcons[stageId]} ${stage.name}: ${stage.subtitle}

${responses}`;
  });

  return `## Reflections (Gibbs' Cycle)

${reflectionSections.join('\n\n---\n\n')}`;
}

function generateAnnotatedConversations(conversations, annotations) {
  const annotatedConvs = conversations.filter(c => annotations[c.id]);

  if (annotatedConvs.length === 0) {
    return `## Annotated Conversations

No conversations were annotated.`;
  }

  // Group by tags
  const tagGroups = {};
  TAGS.forEach(tag => {
    tagGroups[tag.id] = [];
  });

  annotatedConvs.forEach(conv => {
    const annotation = annotations[conv.id];
    if (annotation && annotation.tags) {
      annotation.tags.forEach(tagId => {
        if (tagGroups[tagId]) {
          tagGroups[tagId].push({ conv, annotation });
        }
      });
    }
  });

  // Generate sections for non-empty tag groups
  const tagSections = TAGS
    .filter(tag => tagGroups[tag.id].length > 0)
    .map(tag => {
      const items = tagGroups[tag.id];
      const rows = items.map(({ conv, annotation }) => {
        const date = formatDate(conv.createdAt);
        const platform = conv.platform === 'chatgpt' ? 'ChatGPT' : 'Claude';
        const notes = annotation.notes ? annotation.notes.replace(/\|/g, '\\|').replace(/\n/g, ' ') : '-';
        const rating = annotation.rating ? '★'.repeat(annotation.rating) : '-';

        return `| ${date} | ${platform} | ${escapeMarkdown(conv.title.slice(0, 40))} | ${rating} | ${notes.slice(0, 50)}${notes.length > 50 ? '...' : ''} |`;
      });

      return `### ${tag.label} (${items.length})

| Date | Platform | Title | Rating | Notes |
|------|----------|-------|--------|-------|
${rows.join('\n')}`;
    });

  // Also list conversations with detailed notes
  const withNotes = annotatedConvs.filter(c => annotations[c.id]?.notes?.trim());

  let detailedNotes = '';
  if (withNotes.length > 0) {
    detailedNotes = `

### Detailed Notes

${withNotes.map(conv => {
  const annotation = annotations[conv.id];
  const tags = annotation.tags.map(t => TAGS.find(tag => tag.id === t)?.label || t).join(', ');

  return `#### ${escapeMarkdown(conv.title)}
- **Date**: ${formatDate(conv.createdAt)}
- **Platform**: ${conv.platform === 'chatgpt' ? 'ChatGPT' : 'Claude'}
- **Tags**: ${tags || 'None'}
- **Rating**: ${annotation.rating ? '★'.repeat(annotation.rating) + '☆'.repeat(5 - annotation.rating) : 'Not rated'}

${annotation.notes}`;
}).join('\n\n')}`;
  }

  return `## Annotated Conversations

${tagSections.join('\n\n')}${detailedNotes}`;
}

function generateFooter() {
  return `---

## My Commitments Going Forward

*Based on this reflection, I commit to:*

1.
2.
3.

---

*Generated by [AI Data Reflector](https://github.com) - A privacy-first reflection tool*
*Framework: Gibbs' Reflective Cycle combined with Long & Magerko's AI Literacy Framework*
*All data processing occurred locally in your browser. No data was transmitted to any server.*`;
}

function escapeMarkdown(text) {
  return text
    .replace(/\|/g, '\\|')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/`/g, '\\`')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

/**
 * Convert markdown to simple HTML for preview
 */
export function markdownToHtml(markdown) {
  let html = markdown;

  // Headers
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');

  // Code
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');

  // Tables
  html = html.replace(/^\|(.+)\|$/gm, (match, content) => {
    const cells = content.split('|').map(c => c.trim());
    const isHeader = cells.every(c => c.match(/^-+$/));

    if (isHeader) {
      return ''; // Skip separator row
    }

    const tag = 'td';
    return `<tr>${cells.map(c => `<${tag}>${c}</${tag}>`).join('')}</tr>`;
  });

  // Wrap consecutive table rows
  html = html.replace(/(<tr>.*<\/tr>\n?)+/g, (match) => {
    // Convert first row to header
    const rows = match.trim().split('\n').filter(r => r);
    if (rows.length > 0) {
      rows[0] = rows[0].replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>');
    }
    return `<table>${rows.join('\n')}</table>`;
  });

  // Lists
  html = html.replace(/^\- (.*$)/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Numbered lists
  html = html.replace(/^\d+\. (.*$)/gm, '<li>$1</li>');

  // Paragraphs (lines not already wrapped)
  html = html.replace(/^(?!<[h1-6|ul|ol|li|table|tr|hr|blockquote])(.+)$/gm, '<p>$1</p>');

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  // Blockquotes
  html = html.replace(/<p>&gt; (.*?)<\/p>/g, '<blockquote>$1</blockquote>');

  return html;
}
