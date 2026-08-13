import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"

/**
 * The one markdown renderer in the app — coach messages, retro docs, and
 * summaries all go through here so they format identically. react-markdown
 * renders to React elements (no innerHTML, so model output can't inject
 * markup), remark-gfm adds tables/strikethrough/task-list checkboxes, and
 * @tailwindcss/typography's `prose` classes do the styling.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        // tighter rhythm than the prose default — these render inside chat
        // bubbles and cards, not long-form articles
        "prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-pre:my-2 prose-hr:my-3",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}
