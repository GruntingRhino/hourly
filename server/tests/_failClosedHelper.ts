/**
 * Helper script for testing failClosed behavior.
 * Run with: node --import tsx tests/_failClosedHelper.ts <failClosed>
 */
import { createHybridRateLimit } from "../src/middleware/rateLimit";

async function main() {
  const failClosed = process.argv[2] === "true";
  const ns = `failclosed-${Date.now()}`;

  const limiter = createHybridRateLimit({
    namespace: ns,
    windowMs: 60_000,
    maxPerIp: 5,
    failClosed,
  });

  const req = {
    ip: "127.0.0.1",
    headers: {},
    get: () => undefined,
    user: undefined,
    socket: { remoteAddress: "127.0.0.1" },
  };

  let status = 200;
  let body: unknown = null;
  const res = {
    setHeader: () => undefined,
    status: (code: number) => { status = code; return res; },
    json: (payload: unknown) => { body = payload; return res; },
    end: () => res,
    get statusCode() { return status; },
    set statusCode(c: number) { status = c; },
  };

  let nextCalled = false;
  try {
    await limiter(req as any, res as any, (() => { nextCalled = true; }) as any);
  } catch (e) {
    // ignore
  }
  console.log(JSON.stringify({ status, body, nextCalled }));
}

main();
