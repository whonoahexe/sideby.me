'use client';

import React, { memo } from 'react';
import {
  parseChatMarkdown,
  CHAT_MARKDOWN_PATTERN,
  AUTO_LINK_REGEX,
  trimAutolink,
  type Node,
} from '@/lib/chat-markdown';

export interface MarkdownMessageProps {
  content: string;
  className?: string;
}

export const MarkdownMessage = memo(function MarkdownMessage({ content, className }: MarkdownMessageProps) {
  if (!CHAT_MARKDOWN_PATTERN.test(content)) return <span className={className}>{content}</span>;
  const ast = parseChatMarkdown(content);
  return <span className={className}>{renderAst(ast)}</span>;
});

// Render AST to React
function renderAst(nodes: Node[], keyPrefix = ''): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  nodes.forEach((n, idx) => {
    const key = keyPrefix + idx;
    switch (n.type) {
      case 'text':
        out.push(splitAutoLinks(n.value, key));
        break;
      case 'code':
        out.push(
          <code key={key} className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.7rem] dark:bg-white/10">
            {n.value}
          </code>
        );
        break;
      case 'italic':
        out.push(<em key={key}>{renderAst(n.children, key + '-')}</em>);
        break;
      case 'bold':
        out.push(
          <strong key={key} className="font-semibold">
            {renderAst(n.children, key + '-')}
          </strong>
        );
        break;
      case 'bolditalic':
        out.push(
          <strong key={key} className="font-semibold">
            <em>{renderAst(n.children, key + '-')}</em>
          </strong>
        );
        break;
      case 'underline':
        out.push(
          <span key={key} className="decoration-underline underline underline-offset-2">
            {renderAst(n.children, key + '-')}
          </span>
        );
        break;
      case 'strike':
        out.push(
          <del key={key} className="opacity-80">
            {renderAst(n.children, key + '-')}
          </del>
        );
        break;
      case 'link':
        out.push(
          <a
            key={key}
            href={n.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-2 hover:text-primary-foreground/80"
          >
            {renderAst(n.children, key + '-')}
          </a>
        );
        break;
    }
  });
  return out.flat();
}

function splitAutoLinks(text: string, key: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  AUTO_LINK_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = AUTO_LINK_REGEX.exec(text))) {
    const start = m.index;
    const raw = m[0];
    if (start > last) nodes.push(<React.Fragment key={key + '-t-' + start}>{text.slice(last, start)}</React.Fragment>);
    const { href, display } = trimAutolink(raw);
    nodes.push(
      <a
        key={key + '-l-' + start}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-dotted underline-offset-2 hover:text-primary-foreground/80"
      >
        {display}
      </a>
    );
    last = start + raw.length;
  }
  if (last < text.length) nodes.push(<React.Fragment key={key + '-t-final'}>{text.slice(last)}</React.Fragment>);
  return nodes;
}
