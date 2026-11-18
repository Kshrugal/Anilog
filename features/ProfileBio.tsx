import React from 'react';

export function ProfileBio({ text }: { text: string }) {
  // React text nodes only: no HTML, embeds, arbitrary links, or injected CSS.
  const tokens = String(text || '').slice(0, 2000).split(/(\|\|[\s\S]+?\|\||\*\*[^*]+\*\*|\*[^*\n]+\*)/g);
  return <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-300">{tokens.map((token, i) => token.startsWith('||') && token.endsWith('||') ? <details key={i} className="my-2 border-l-2 border-current pl-3"><summary className="cursor-pointer text-xs">Spoiler</summary><span>{token.slice(2, -2)}</span></details> : token.startsWith('**') && token.endsWith('**') ? <strong key={i}>{token.slice(2, -2)}</strong> : token.startsWith('*') && token.endsWith('*') ? <em key={i}>{token.slice(1, -1)}</em> : <React.Fragment key={i}>{token}</React.Fragment>)}</div>;
}
