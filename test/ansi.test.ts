import { describe, expect, it } from "vitest";
import { ansiColorCss, parseAnsi, stripAnsi } from "@/lib/ansi";

const ESC = "\x1b";

describe("ansi", () => {
  it("parses the socket.io debug line from the report", () => {
    const line = `${ESC}[34mdebug${ESC}[39m: Broadcasting event "notification"`;
    const { spans, end } = parseAnsi(line);
    expect(spans).toEqual([
      { text: "debug", style: { fg: 4 } },
      { text: ': Broadcasting event "notification"', style: null },
    ]);
    expect(end).toEqual({ fg: undefined });
  });

  it("handles bold, bright, 256-color, truecolor and reset", () => {
    const { spans } = parseAnsi(`${ESC}[1;91mA${ESC}[38;5;208mB${ESC}[48;2;10;20;30mC${ESC}[0mD`);
    expect(spans).toEqual([
      { text: "A", style: { bold: true, fg: 9 } },
      { text: "B", style: { bold: true, fg: 208 } },
      { text: "C", style: { bold: true, fg: 208, bg: "rgb(10,20,30)" } },
      { text: "D", style: null },
    ]);
  });

  it("carries style across calls", () => {
    const first = parseAnsi(`ok ${ESC}[32mgreen starts`);
    const second = parseAnsi(" still green\n", first.end);
    expect(second.spans).toEqual([{ text: " still green\n", style: { fg: 2 } }]);
    expect(parseAnsi(`${ESC}[mreset`, second.end).spans).toEqual([{ text: "reset", style: null }]);
  });

  it("removes non-color escapes (cursor, erase line, hyperlinks)", () => {
    const text = `${ESC}[2K${ESC}[1Gprogress${ESC}]8;;https://x.dev${ESC}\\link${ESC}]8;;${ESC}\\ done${ESC}[?25h`;
    expect(stripAnsi(text)).toBe("progresslink done");
    expect(parseAnsi(text).spans).toEqual([{ text: "progresslink done", style: null }]);
  });

  it("leaves plain text untouched", () => {
    expect(parseAnsi("plain").spans).toEqual([{ text: "plain", style: null }]);
    expect(stripAnsi("plain")).toBe("plain");
  });

  it("maps palette colors to CSS", () => {
    expect(ansiColorCss(4)).toBe("var(--ansi-4)");
    expect(ansiColorCss(196)).toBe("rgb(255,0,0)");
    expect(ansiColorCss(244)).toBe("rgb(128,128,128)");
    expect(ansiColorCss("rgb(1,2,3)")).toBe("rgb(1,2,3)");
  });
});
