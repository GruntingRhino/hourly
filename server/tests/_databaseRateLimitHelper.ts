import { createHybridRateLimit } from "../src/middleware/rateLimit";

async function main() {
  const [namespace, ip] = process.argv.slice(2);
  if (!namespace || !ip) throw new Error("Expected <namespace> <ip>");

  const limiter = createHybridRateLimit({
    namespace,
    windowMs: 60_000,
    maxPerIp: 2,
    failClosed: true,
  });

  let status = 200;
  let nextCalled = false;
  const res = {
    setHeader: () => undefined,
    status: (code: number) => { status = code; return res; },
    json: () => res,
    end: () => res,
    get statusCode() { return status; },
    set statusCode(code: number) { status = code; },
  };
  const req = { ip, headers: {}, get: () => undefined, socket: { remoteAddress: ip } };

  await limiter(req as any, res as any, (() => { nextCalled = true; }) as any);
  if (nextCalled) res.end();
  console.log(JSON.stringify({ status, nextCalled }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
