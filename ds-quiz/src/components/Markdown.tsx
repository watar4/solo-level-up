import ReactMarkdown from 'react-markdown';

/** 設問文・解説の Markdown 表示（最小限のスタイル） */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-mini">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
