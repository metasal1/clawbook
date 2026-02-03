"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function DocContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none
      prose-headings:text-[#3b5998] prose-headings:border-b prose-headings:border-[#d3dce8] prose-headings:pb-1
      prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
      prose-a:text-[#3b5998] prose-a:no-underline hover:prose-a:underline
      prose-code:bg-[#f0f2f5] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
      prose-pre:bg-[#1e1e1e] prose-pre:text-[#d4d4d4] prose-pre:rounded prose-pre:text-xs
      prose-table:text-xs prose-th:bg-[#d3dce8] prose-th:text-[#3b5998] prose-th:px-3 prose-th:py-1.5
      prose-td:px-3 prose-td:py-1.5 prose-td:border-[#d3dce8]
      prose-blockquote:border-[#3b5998] prose-blockquote:text-gray-600
    ">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
