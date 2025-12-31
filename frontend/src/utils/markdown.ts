import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { Tokens } from 'marked';

// Configure Renderer
const renderer = new marked.Renderer();
const originalCodeRenderer = renderer.code;

renderer.code = function(codeToken: Tokens.Code) {
  const rawCodeBlock = originalCodeRenderer.call(this, codeToken);
  
  const copyButton = `
    <button class="copy-code-button" title="Copy code">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
      <span class="copy-text">Copy</span>
    </button>
  `;
  
  return `<div class="code-block-wrapper">${copyButton}${rawCodeBlock}</div>`;
};

marked.use({ renderer, gfm: true, breaks: true });

export const renderMarkdown = (text: string): string => {
  return DOMPurify.sanitize(marked.parse(text) as string);
};
