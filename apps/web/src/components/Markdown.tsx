import { Fragment, type ReactNode } from "react";

// Lightweight, dependency-free markdown renderer for chat messages. The grounded LLM
// emits everyday markdown (bold, italics, inline code, links, bullet/numbered lists),
// which used to leak into the UI as raw `**`/`[text](url)` syntax. We render to React
// nodes rather than HTML strings, so there's no `dangerouslySetInnerHTML` and no XSS
// surface — link URLs are also restricted to http(s)/mailto.

const INLINE_PATTERN =
  /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3|`([^`]+?)`|\[([^\]]+)\]\(([^)\s]+)\)/;

function safeHref(url: string): string | null {
  const trimmed = url.trim();
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) return trimmed;
  if (/^\//.test(trimmed)) return trimmed; // same-origin relative links
  return null;
}

// Parse a single line of inline markdown into React nodes. `keyPrefix` keeps React keys
// unique across the many small fragments a message produces.
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let remaining = text;
  let index = 0;

  while (remaining) {
    const match = INLINE_PATTERN.exec(remaining);
    if (!match) {
      nodes.push(remaining);
      break;
    }

    if (match.index > 0) {
      nodes.push(remaining.slice(0, match.index));
    }

    const key = `${keyPrefix}-${index++}`;
    if (match[2] !== undefined) {
      nodes.push(<strong key={key}>{renderInline(match[2], key)}</strong>);
    } else if (match[4] !== undefined) {
      nodes.push(<em key={key}>{renderInline(match[4], key)}</em>);
    } else if (match[5] !== undefined) {
      nodes.push(<code key={key}>{match[5]}</code>);
    } else if (match[6] !== undefined) {
      const href = safeHref(match[7]);
      nodes.push(
        href ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer">
            {match[6]}
          </a>
        ) : (
          match[6]
        )
      );
    }

    remaining = remaining.slice(match.index + match[0].length);
  }

  return nodes;
}

type Block =
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "p"; lines: string[] };

// Group lines into paragraph and list blocks, splitting on blank lines and list markers.
function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let current: Block | null = null;

  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };

  for (const line of lines) {
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);

    if (bullet) {
      if (current?.type !== "ul") {
        flush();
        current = { type: "ul", items: [] };
      }
      current.items.push(bullet[1]);
    } else if (ordered) {
      if (current?.type !== "ol") {
        flush();
        current = { type: "ol", items: [] };
      }
      current.items.push(ordered[1]);
    } else if (line.trim() === "") {
      flush();
    } else {
      if (current?.type !== "p") {
        flush();
        current = { type: "p", lines: [] };
      }
      current.lines.push(line);
    }
  }
  flush();

  return blocks;
}

export function Markdown({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === "ul" || block.type === "ol") {
          const List = block.type === "ul" ? "ul" : "ol";
          return (
            <List key={i} className="md-list">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item, `${i}-${j}`)}</li>
              ))}
            </List>
          );
        }
        return (
          <p key={i} className="md-p">
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {renderInline(line, `${i}-${j}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}
