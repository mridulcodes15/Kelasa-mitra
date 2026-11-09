/**
 * Turning a speech-recognition result list into text, robust to Android Chrome.
 *
 * With continuous recognition the browser sends the whole result list on every event.
 * Android Chrome often lists each growing partial as its own entry ("I", "I am", "I am a"),
 * and may mark each of them final, and re-sends the list from index 0. So results are stored
 * by index (overwritten, never appended), and an entry that the next entry extends word for
 * word is dropped.
 */
export interface Segment {
  text: string;
  final: boolean;
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ');

/** True if `longer` is `shorter` followed by more words (or the same text). */
function extendsWords(longer: string, shorter: string): boolean {
  const a = longer.toLocaleLowerCase();
  const b = shorter.toLocaleLowerCase();
  return a === b || a.startsWith(b + ' ');
}

/** Drop entries that a later neighbour repeats and extends (cumulative partials). */
export function collapseSegments(segments: (Segment | undefined)[]): Segment[] {
  const out: Segment[] = [];
  for (const seg of segments) {
    if (!seg) continue;
    const text = norm(seg.text);
    if (!text) continue;
    const last = out[out.length - 1];
    if (last && extendsWords(text, last.text)) {
      out[out.length - 1] = { text, final: seg.final || (last.final && text === last.text) };
    } else if (last && extendsWords(last.text, text)) {
      // a stale shorter partial after a longer one: keep the longer text
      out[out.length - 1] = { text: last.text, final: last.final || seg.final };
    } else {
      out.push({ text, final: seg.final });
    }
  }
  return out;
}

export function joinText(...parts: string[]): string {
  return norm(parts.filter((p) => p && p.trim()).join(' '));
}

/** Final and interim text of one recognition session. */
export function sessionText(segments: (Segment | undefined)[]): { final: string; interim: string } {
  const collapsed = collapseSegments(segments);
  return {
    final: joinText(...collapsed.filter((s) => s.final).map((s) => s.text)),
    interim: joinText(...collapsed.filter((s) => !s.final).map((s) => s.text)),
  };
}
