import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';

interface MarkdownProps {
  children: string;
  className?: string;
}

export const Markdown: React.FC<MarkdownProps> = ({ children, className = '' }) => {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeRaw]}
        components={{
        // 自定义渲染规则
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-inside space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside space-y-1">{children}</ol>,
        li: ({ children }) => <li className="text-sm">{children}</li>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
            {children}
          </a>
        ),
        img: ({ src, alt }) => (
          <img 
            src={src} 
            alt={alt || ''} 
            className="max-w-full h-auto rounded-lg my-2"
            loading="lazy"
          />
        ),
        h1: ({ children }) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-bold mb-2">{children}</h3>,
        code: ({ className, children }) => {
          const isInline = !className;
          return isInline ? (
            <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">{children}</code>
          ) : (
            <code className={`${className} block bg-gray-100 p-2 rounded text-sm font-mono overflow-x-auto`}>
              {children}
            </code>
          );
        },
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        br: () => <br />,
        table: ({ children }) => (
          <div className="overflow-x-auto my-4">
            <table className="min-w-full border-collapse border border-gray-300">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-gray-100">{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr className="border-b border-gray-300">{children}</tr>,
        th: ({ children }) => (
          <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-gray-300 px-4 py-2">
            {children}
          </td>
        ),
      }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
};

