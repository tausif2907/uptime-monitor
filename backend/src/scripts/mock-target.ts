/**
 * Load-test target: a local HTTP server that answers 200 after a random 20–200 ms delay.
 * Usage: pnpm --filter @uptime/backend load:target   (listens on LOAD_TARGET_PORT, default 4100)
 */
import { createServer } from "node:http";

const port = Number(process.env.LOAD_TARGET_PORT ?? 4100);
let served = 0;

createServer((_req, res) => {
  served++;
  setTimeout(() => res.writeHead(200).end("ok"), 20 + Math.random() * 180);
}).listen(port, () => {
  console.log(`mock target listening on http://127.0.0.1:${port}`);
});

setInterval(() => console.log(`served ${served} requests`), 60_000);
