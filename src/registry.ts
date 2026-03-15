import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import type { Server } from "node:http";

let embeddedUrl: string | null = null;

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

export async function getRegistryUrl(): Promise<string> {
  if (process.env.VERDACCIO_URL) {
    return process.env.VERDACCIO_URL;
  }

  if (embeddedUrl) {
    return embeddedUrl;
  }

  const storagePath = await mkdtemp(
    path.join(os.tmpdir(), "verdaccio-mcp-")
  );
  const port = await getFreePort();

  // Dynamic import to handle CJS verdaccio module from ESM
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { runServer } = (await import("verdaccio")) as any;

  const server: Server = await runServer({
    storage: storagePath,
    configPath: storagePath,
    auth: {
      htpasswd: {
        file: path.join(storagePath, "htpasswd"),
        max_users: 1000,
      },
    },
    packages: {
      "@*/*": {
        access: "$all",
        publish: "$all",
      },
      "**": {
        access: "$all",
        publish: "$all",
      },
    },
    uplinks: {
      npmjs: {
        url: "https://registry.npmjs.org/",
      },
    },
    log: { type: "stdout", format: "pretty", level: "error" },
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(port, "127.0.0.1", () => resolve());
    server.once("error", reject);
  });

  embeddedUrl = `http://127.0.0.1:${port}`;

  const cleanup = (): void => {
    server.close();
  };
  process.on("exit", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);

  return embeddedUrl;
}
