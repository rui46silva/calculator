import type { ReactNode } from 'react';

/** Renders the assistant's light markdown (paragraphs, "- " lists, **bold**) without injecting HTML. */
export function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const bold = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part));
  const flush = () => {
    if (list.length) blocks.push(<ul key={`l${blocks.length}`}>{list.map((l, i) => <li key={i}>{bold(l)}</li>)}</ul>);
    list = [];
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const item = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)/);
    if (item) list.push(item[1]);
    else {
      flush();
      if (line) blocks.push(<p key={`p${blocks.length}`}>{bold(line.replace(/^#+\s*/, ''))}</p>);
    }
  }
  flush();
  return <div className="rich">{blocks}</div>;
}
