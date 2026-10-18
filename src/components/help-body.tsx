import Link from "next/link";
export function helpHeadingId(title: string) { return title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80); }

function inline(text: string) {
  return text.split(/(\[[^\]]+\]\(\/[^)]+\))/g).map((part, index) => {
    const match = /^\[([^\]]+)\]\((\/(?!\/)[^)]+)\)$/.exec(part);
    return match ? <Link key={index} href={match[2]} className="font-semibold text-accent underline underline-offset-4">{match[1]}</Link> : part;
  });
}

export function HelpBody({ body }: { body: string }) {
  return <div className="space-y-5 text-[15px] leading-8 text-[#c2d0c1]">{body.split(/\n\s*\n/).map((block, index) => {
    const lines = block.trim().split("\n");
    if (block.startsWith("## ")) return <h2 key={index} id={helpHeadingId(block.slice(3))} className="scroll-mt-28 pt-5 text-2xl font-black text-white">{block.slice(3)}</h2>;
    if (lines.every(line => line.startsWith("- "))) return <ul key={index} className="list-disc space-y-2 pl-6">{lines.map((line, i) => <li key={i}>{inline(line.slice(2))}</li>)}</ul>;
    if (lines.length >= 2 && lines[0].startsWith("|") && /^\|?[\s|:-]+\|?$/.test(lines[1])) {
      const cells = (line: string) => line.replace(/^\||\|$/g, "").split("|").map(cell => cell.trim());
      return <div key={index} className="overflow-x-auto rounded-xl border border-line"><table className="w-full min-w-[480px] text-left text-sm"><thead className="bg-[#1a2a1b] text-white"><tr>{cells(lines[0]).map((cell, i) => <th key={i} className="border-b border-line px-4 py-3">{inline(cell)}</th>)}</tr></thead><tbody>{lines.slice(2).map((line, row) => <tr key={row} className="border-t border-line">{cells(line).map((cell, col) => <td key={col} className="px-4 py-3">{inline(cell)}</td>)}</tr>)}</tbody></table></div>;
    }
    return <p key={index}>{inline(block)}</p>;
  })}</div>;
}
