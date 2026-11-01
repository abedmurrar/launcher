import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Socket } from "socket.io-client";
import { createCommand, startSocketServer, waitFor, type TestSocketServer } from "./helpers";

interface Ack {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  code?: number;
}

let server: TestSocketServer;
let socket: Socket;
const act = (type: string, payload: Record<string, unknown>) =>
  socket.timeout(15_000).emitWithAck("action", { type, ...payload }) as Promise<Ack>;

beforeAll(async () => {
  server = await startSocketServer();
  socket = await server.connect();
});
afterAll(async () => {
  await server.close();
});

describe("socket handler", () => {
  it("acks actions with the server result (errors are not retried)", async () => {
    const id = await createCommand("sleep 30");
    const ok = await act("run", { commandId: id });
    expect(ok).toMatchObject({ success: true, data: { run_id: expect.any(Number) } });
    const again = await act("run", { commandId: id });
    expect(again).toMatchObject({ success: false, code: 409 });
    expect(await act("nope", {})).toMatchObject({ success: false, code: 400 });
    expect(await act("stop", { commandId: id })).toMatchObject({ success: true });
  });

  it("debounces list broadcasts", async () => {
    let events = 0;
    const onCommands = () => events++;
    socket.on("commands", onCommands);
    const ids = await Promise.all([1, 2, 3, 4, 5].map(() => createCommand("true")));
    await Promise.all(ids.map((commandId) => act("run", { commandId })));
    await new Promise((r) => setTimeout(r, 500));
    socket.off("commands", onCommands);
    expect(events).toBeGreaterThan(0);
    expect(events).toBeLessThanOrEqual(4);
  });

  it("history + live batches de-duplicate into complete ordered output", async () => {
    const id = await createCommand("for i in $(seq 1 3000); do echo line $i; done; sleep 0.3");
    const run = await act("run", { commandId: id });
    const runId = run.data!.run_id as number;

    let history: { chunks: { content: string }[]; lastId: number } | null = null;
    const live: { chunks: { data: string }[]; lastId?: number }[] = [];
    let finished = false;
    socket.on("log_history", (p) => p.runId === runId && (history = p));
    socket.on("log_batch", (p) => p.runId === runId && live.push(p));
    socket.on("log_finished", (p) => p.runId === runId && (finished = true));
    socket.emit("subscribe_logs", runId);

    expect(await waitFor(() => finished, 15_000)).toBe(true);
    const h = history as unknown as { chunks: { content: string }[]; lastId: number };
    const text =
      h.chunks.map((c) => c.content).join("") +
      live
        .filter((b) => b.lastId === undefined || b.lastId > h.lastId)
        .flatMap((b) => b.chunks.map((c) => c.data))
        .join("");
    const nums = text.trim().split("\n").map((l) => Number(l.slice(5)));
    expect(nums).toHaveLength(3000);
    expect(nums.every((n, i) => n === i + 1)).toBe(true);
  });

  it("re-subscribing after a reconnect re-sends history", async () => {
    const id = await createCommand("echo one; sleep 30");
    const run = await act("run", { commandId: id });
    const runId = run.data!.run_id as number;
    const histories: unknown[] = [];
    socket.on("log_history", (p) => p.runId === runId && histories.push(p));
    socket.emit("subscribe_logs", runId);
    expect(await waitFor(() => histories.length === 1)).toBe(true);

    socket.disconnect();
    socket.connect();
    await waitFor(() => socket.connected);
    socket.emit("subscribe_logs", runId);
    expect(await waitFor(() => histories.length === 2)).toBe(true);
    await act("stop", { commandId: id });
  });
});
