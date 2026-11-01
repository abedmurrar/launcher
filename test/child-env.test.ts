import { describe, expect, it } from "vitest";
import { runCommand } from "@/lib/actions";
import { insertCommand } from "@/lib/db/queries";
import { sanitizeEnv } from "@/lib/process-manager/child-env";
import { ok, runLogText, waitForRunStatus } from "./helpers";

describe("child environment", () => {
  it("strips the launcher's own runtime variables", () => {
    const env = sanitizeEnv({
      PATH: "/usr/bin",
      HOME: "/home/u",
      NODE_ENV: "production",
      PORT: "9555",
      HOST: "0.0.0.0",
      TURBOPACK: "1",
      NEXT_DEPLOYMENT_ID: "",
      __NEXT_PRIVATE_ORIGIN: "x",
      INIT_CWD: "/launcher",
      npm_lifecycle_event: "start",
      npm_config_cache: "/c",
      LAUNCHER_TOKEN: "secret",
      NODE_OPTIONS: "--max-old-space-size=4096",
      SSH_AUTH_SOCK: "/tmp/ssh",
    });
    expect(env).toEqual({
      PATH: "/usr/bin",
      HOME: "/home/u",
      NODE_OPTIONS: "--max-old-space-size=4096",
      SSH_AUTH_SOCK: "/tmp/ssh",
    });
  });

  it("strips PM2 bookkeeping only when running under PM2", () => {
    const pm2 = sanitizeEnv({ pm_id: "0", name: "launcher", status: "online", NODE_APP_INSTANCE: "0", PM2_HOME: "/h/.pm2", KEEP: "1" });
    expect(pm2).toEqual({ PM2_HOME: "/h/.pm2", KEEP: "1" });
    expect(sanitizeEnv({ name: "mine", status: "x" })).toEqual({ name: "mine", status: "x" });
  });

  it("managed commands don't inherit NODE_ENV/PORT, but command env can set them", async () => {
    process.env.PORT = "9555";
    process.env.npm_lifecycle_event = "start";
    try {
      const plain = await insertCommand("env-plain", 'echo "node_env=${NODE_ENV:-unset} port=${PORT:-unset} npm=${npm_lifecycle_event:-unset}"', "/tmp", "{}");
      const r1 = ok(await runCommand(plain));
      expect(await waitForRunStatus(r1.run_id, "success")).toBe(true);
      expect(await runLogText(r1.run_id)).toBe("node_env=unset port=unset npm=unset\n");

      const custom = await insertCommand("env-custom", 'echo "node_env=$NODE_ENV port=$PORT"', "/tmp", JSON.stringify({ NODE_ENV: "development", PORT: "3000" }));
      const r2 = ok(await runCommand(custom));
      expect(await waitForRunStatus(r2.run_id, "success")).toBe(true);
      expect(await runLogText(r2.run_id)).toBe("node_env=development port=3000\n");
    } finally {
      delete process.env.PORT;
      delete process.env.npm_lifecycle_event;
    }
  });
});
