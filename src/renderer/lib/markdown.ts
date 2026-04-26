import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: true });

const ALLOWED_TAGS = [
  'a',
  'b',
  'br',
  'blockquote',
  'code',
  'del',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'sub',
  'sup',
  'u',
  'ul',
  'img',
];

const ALLOWED_ATTR = ['href', 'title', 'alt', 'src', 'class', 'data-mx-pill', 'rel', 'target'];

const SAFE_HREF = /^(https?:|mailto:|matrix:|#)/i;

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (!(node instanceof HTMLElement)) return;
  if (node.tagName !== 'A') return;
  const href = node.getAttribute('href');
  if (!href || !SAFE_HREF.test(href)) {
    node.removeAttribute('href');
    return;
  }
  node.setAttribute('target', '_blank');
  node.setAttribute('rel', 'noopener noreferrer');
});

export function plainTextToHtml(body: string): string {
  const html = marked.parse(body, { async: false }) as string;
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}

export function sanitizeEventHtml(htmlFromEvent: string): string {
  return DOMPurify.sanitize(htmlFromEvent, { ALLOWED_TAGS, ALLOWED_ATTR });
}

const URL_REGEX = /\b(https?:\/\/[^\s<>"'`]+)/g;
const TRAILING_PUNCT = /[.,!?;:)\]}>'"`]+$/;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderPlainBody(body: string): string {
  const withLinks = escapeHtml(body).replace(URL_REGEX, (match) => {
    const trailing = match.match(TRAILING_PUNCT)?.[0] ?? '';
    const url = trailing ? match.slice(0, -trailing.length) : match;
    if (!SAFE_HREF.test(url)) return match;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trailing}`;
  });
  const withBreaks = withLinks.replace(/\n/g, '<br>');
  return DOMPurify.sanitize(withBreaks, { ALLOWED_TAGS, ALLOWED_ATTR });
}

export function composeTextContent(body: string): {
  msgtype: 'm.text';
  body: string;
  format?: 'org.matrix.custom.html';
  formatted_body?: string;
} {
  const html = plainTextToHtml(body);
  // If the output doesn't contain anything beyond a plain paragraph, skip HTML.
  const strippedPlain = html
    .replace(/<p>|<\/p>/g, '')
    .replace(/<br\s*\/?>/g, '\n')
    .trim();
  if (strippedPlain === body.trim() || !/<[a-z][^>]*>/i.test(html)) {
    return { msgtype: 'm.text', body };
  }
  return {
    msgtype: 'm.text',
    body,
    format: 'org.matrix.custom.html',
    formatted_body: html,
  };
}
