import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MathRendererProps {
  content: string;
  className?: string;
}

export const MathRenderer: React.FC<MathRendererProps> = ({ content, className = '' }) => {
  if (!content) return null;

  // Sanitize double-escaped backslashes commonly emitted in JSON strings (e.g. \\frac -> \frac)
  // and normalize \(...\) / \[...\] into standard $...$ / $$...$$ delimiters
  const normalizedContent = String(content)
    .replace(/\\\\([a-zA-Z]+)/g, '\\$1')
    .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$')
    .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');

  return (
    <div className={`prose-math inline ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <span>{children}</span>,
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MathRenderer;
