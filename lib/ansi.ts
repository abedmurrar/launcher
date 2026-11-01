/**
 * Minimal ANSI escape handling for process output.
 * - SGR (colors/styles): parsed into styled spans (16 colors, 256-color, truecolor, bold, dim,
 *   italic, underline, inverse, strikethrough).
 * - Everything else (cursor movement, erase line, OSC hyperlinks/titles, ...): removed.
 */

export type AnsiColor = number | string; // 0–255 palette index, or "rgb(r,g,b)"

export interface AnsiStyle {
  fg?: AnsiColor;
  bg?: AnsiColor;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  inverse?: boolean;
  strike?: boolean;
}

export interface AnsiSpan {
  text: string;
  /** null = default style */
  style: AnsiStyle | null;
}

// CSI sequences (ESC [ params intermediates final), OSC (ESC ] ... BEL | ESC \), other 2-byte escapes.
const ESCAPE_RE = /\x1b(?:\[([0-?]*)[ -/]*([@-~])|\][^\x07\x1b]*(?:\x07|\x1b\\)?|[@-Z\\-_])/g;

export function stripAnsi(text: string): string {
  return text.includes("\x1b") ? text.replace(ESCAPE_RE, "") : text;
}

function isDefault(style: AnsiStyle): boolean {
  for (const key in style) {
    if (style[key as keyof AnsiStyle] !== undefined && style[key as keyof AnsiStyle] !== false) return false;
  }
  return true;
}

export function styleKey(style: AnsiStyle): string {
  return isDefault(style) ? "" : JSON.stringify(style);
}

function applySgr(current: AnsiStyle, params: string): AnsiStyle {
  const codes = params === "" ? [0] : params.split(/[;:]/).map((p) => (p === "" ? 0 : Number(p)));
  let s: AnsiStyle = { ...current };
  for (let i = 0; i < codes.length; i++) {
    const c = codes[i];
    if (c === 0) s = {};
    else if (c === 1) s.bold = true;
    else if (c === 2) s.dim = true;
    else if (c === 3) s.italic = true;
    else if (c === 4) s.underline = true;
    else if (c === 7) s.inverse = true;
    else if (c === 9) s.strike = true;
    else if (c === 21 || c === 22) {
      s.bold = undefined;
      s.dim = undefined;
    } else if (c === 23) s.italic = undefined;
    else if (c === 24) s.underline = undefined;
    else if (c === 27) s.inverse = undefined;
    else if (c === 29) s.strike = undefined;
    else if (c >= 30 && c <= 37) s.fg = c - 30;
    else if (c >= 90 && c <= 97) s.fg = c - 90 + 8;
    else if (c === 39) s.fg = undefined;
    else if (c >= 40 && c <= 47) s.bg = c - 40;
    else if (c >= 100 && c <= 107) s.bg = c - 100 + 8;
    else if (c === 49) s.bg = undefined;
    else if (c === 38 || c === 48) {
      const key = c === 38 ? "fg" : "bg";
      if (codes[i + 1] === 5 && codes[i + 2] !== undefined) {
        s[key] = Math.max(0, Math.min(255, codes[i + 2]));
        i += 2;
      } else if (codes[i + 1] === 2 && codes[i + 4] !== undefined) {
        const [r, g, b] = [codes[i + 2], codes[i + 3], codes[i + 4]].map((v) => Math.max(0, Math.min(255, v)));
        s[key] = `rgb(${r},${g},${b})`;
        i += 4;
      }
    }
  }
  return s;
}

/**
 * Split text into styled spans, starting from `start` style (the style in effect at the end of
 * the previous text). Returns the spans and the style in effect at the end.
 */
export function parseAnsi(text: string, start: AnsiStyle = {}): { spans: AnsiSpan[]; end: AnsiStyle } {
  if (!text.includes("\x1b")) {
    return { spans: text ? [{ text, style: isDefault(start) ? null : start }] : [], end: start };
  }
  const spans: AnsiSpan[] = [];
  let style = start;
  let last = 0;
  const push = (t: string) => {
    if (!t) return;
    const s = isDefault(style) ? null : style;
    const prev = spans[spans.length - 1];
    if (prev && (prev.style === s || (prev.style && s && styleKey(prev.style) === styleKey(s)))) prev.text += t;
    else spans.push({ text: t, style: s });
  };
  for (const m of text.matchAll(ESCAPE_RE)) {
    push(text.slice(last, m.index));
    last = m.index! + m[0].length;
    if (m[2] === "m") style = applySgr(style, m[1] ?? "");
  }
  push(text.slice(last));
  return { spans, end: style };
}

/** CSS color for a palette index or rgb() string. 0–15 use theme variables (see globals.css). */
export function ansiColorCss(color: AnsiColor): string {
  if (typeof color === "string") return color;
  if (color < 16) return `var(--ansi-${color})`;
  if (color >= 232) {
    const v = 8 + (color - 232) * 10;
    return `rgb(${v},${v},${v})`;
  }
  const n = color - 16;
  const steps = [0, 95, 135, 175, 215, 255];
  return `rgb(${steps[Math.floor(n / 36)]},${steps[Math.floor(n / 6) % 6]},${steps[n % 6]})`;
}
