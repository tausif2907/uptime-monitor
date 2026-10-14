import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * Local HTTP server for integration tests:
 *   /ok -> 200, /error -> 500, /slow -> 200 after 300 ms, /hang -> never responds,
 *   /redirect -> 302 to /ok, /loop -> redirects to itself, /status/<code> -> that code,
 *   /toggle -> whatever `state.toggleStatus` is (flip it from a test).
 */
export interface MockServer {
  url: string;
  state: { toggleStatus: number };
  close: () => Promise<void>;
}

export async function startMockServer(): Promise<MockServer> {
  const state = { toggleStatus: 200 };
  const server: Server = createServer((req, res) => {
    const path = req.url ?? "/";
    if (path === "/ok") return void res.writeHead(200).end("ok");
    if (path === "/error") return void res.writeHead(500).end("boom");
    if (path === "/slow") {
      setTimeout(() => res.writeHead(200).end("slow"), 300);
      return;
    }
    if (path === "/hang") return; // never respond
    if (path === "/redirect") return void res.writeHead(302, { location: "/ok" }).end();
    if (path === "/loop") return void res.writeHead(302, { location: "/loop" }).end();
    if (path === "/toggle") return void res.writeHead(state.toggleStatus).end();
    const match = /^\/status\/(\d{3})$/.exec(path);
    if (match) return void res.writeHead(Number(match[1])).end();
    res.writeHead(404).end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    state,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
