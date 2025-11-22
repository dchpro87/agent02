"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Copy, Check } from "lucide-react";
import "highlight.js/styles/github-dark.css";

interface MarkdownMessageProps {
  content: string;
}

export default function MarkdownMessage({ content }: MarkdownMessageProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      // Get the rendered HTML content
      const markdownContainer = document.querySelector(".markdown-content");
      if (!markdownContainer) return;

      // Create a range and selection to copy the formatted content
      const range = document.createRange();
      range.selectNodeContents(markdownContainer);

      const selection = window.getSelection();
      if (!selection) return;

      selection.removeAllRanges();
      selection.addRange(range);

      // Copy as both HTML and plain text
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([markdownContainer.innerHTML], {
            type: "text/html",
          }),
          "text/plain": new Blob(
            [
              (markdownContainer as HTMLElement).innerText ||
                markdownContainer.textContent ||
                "",
            ],
            { type: "text/plain" }
          ),
        }),
      ]);

      // Clear selection
      selection.removeAllRanges();

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy text:", error);
    }
  };

  return (
    <div className='relative group'>
      <div
        className='markdown-content prose prose-sm dark:prose-invert max-w-none 
        prose-pre:bg-zinc-900 prose-pre:text-zinc-100 
        prose-code:text-pink-600 dark:prose-code:text-pink-400
        prose-p:my-4 prose-p:leading-7
        prose-headings:mt-8 prose-headings:mb-4 prose-headings:leading-tight
        prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-base
        prose-blockquote:my-4
        [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:my-3 [&_ul]:list-outside
        [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:my-3 [&_ol]:list-outside
        [&_li]:list-item [&_li]:my-1 [&_li]:ml-0
        [&_ul_ul]:list-[circle] [&_ul_ul]:ml-6 [&_ul_ul]:my-2
        [&_ol_ul]:list-[circle] [&_ol_ul]:ml-6 [&_ol_ul]:my-2
        [&>*]:mb-4 [&>*:last-child]:mb-0'
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            // Custom link styling
            a: ({ children, ...props }) => (
              <a
                {...props}
                target='_blank'
                rel='noopener noreferrer'
                className='text-blue-600 dark:text-blue-400 hover:underline'
              >
                {children}
              </a>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
      <button
        onClick={handleCopy}
        className='absolute top-2 right-2 p-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 opacity-0 group-hover:opacity-100 transition-all duration-200'
        title='Copy to clipboard'
      >
        {copied ? (
          <Check className='w-4 h-4 text-green-600 dark:text-green-400' />
        ) : (
          <Copy className='w-4 h-4' />
        )}
      </button>
    </div>
  );
}
