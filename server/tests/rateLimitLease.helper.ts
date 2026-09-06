import * as http from "node:http";
import { fileURLToPath } from "node:url";

const modulePath = process.argv[2]!;
const scenario = process.argv[3]!;
let clock = scenario === "cross-window" ? 999 : 1_000;
Date.now = () => clock;
const values = new Map<string, number>();
const expiry = new Map<string, number>();
let evalError = false;
const server = http.createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const commands = JSON.parse(body) as Array<[string, ...string[]]>;
  const results = commands.map(([command, ...args]) => {
    const op = command.toUpperCase();
    if (op === "INCR") {
      const key = args[0]!;
      if (expiry.has(key) && expiry.get(key)! <= clock) values.delete(key);
      const value = (values.get(key) ?? 0) + 1;
      values.set(key, value);
      return { result: value };
    }
    if (op === "EXPIRE") {
      expiry.set(args[0]!, clock + Number(args[1]) * 1000);
      return { result: 1 };
    }
    if (op === "EVAL") {
      if (evalError) return { error: "script failed" };
      const key = args[2]!;
      if (expiry.has(key) && expiry.get(key)! <= clock) values.delete(key);
      const current = values.get(key) ?? 0;
      if (current <= 0) return { result: 0 };
      values.set(key, current - 1);
      return { result: current - 1 };
    }
    return { error: `unexpected ${op}` };
  });
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(results));
});
async function main() {
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${(server.address() as any).port}`;
process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
const { createHybridRateLimit } = await import(fileURLToPath(new URL(modulePath, import.meta.url)));

type Any = Record<string, any>;
const req = () => ({ ip: "198.51.100.10", headers: {}, get: () => undefined, socket: { remoteAddress: "198.51.100.10" } }) as Any;
const makeRes = () => {
  let status = 200;
  const res: Any = {
    setHeader() {},
    status(code: number) { status = code; return res; },
    json(body: unknown) { res.body = body; return res; },
    end() { return res; },
  };
  Object.defineProperty(res, "statusCode", { get: () => status, set: (v) => { status = v; } });
  return res;
};
const acquire = async (limiter: any, responseStatus = 200) => {
  const res = makeRes();
  let proceeded = false;
  await limiter(req(), res, () => { proceeded = true; });
  if (!proceeded) return { res, end: Promise.resolve(), status: res.statusCode };
  res.statusCode = responseStatus;
  return { res, end: res.end(), status: responseStatus };
};
const ns = `lease-${scenario}`;
const limiter = createHybridRateLimit({ namespace: ns, windowMs: 1_000, maxPerIp: scenario === "failed-response" ? 1 : 10, skipSuccessfulRequests: true });
let result: Any;
if (scenario === "cross-window") {
  const first = await acquire(limiter);
  clock = 1_001;
  await first.end;
  const second = await acquire(limiter);
  result = { oldBucket: values.get([...values.keys()].find((key) => key.endsWith(":0"))!) ?? -1, newBucket: values.get([...values.keys()].find((key) => key.endsWith(":1"))!) ?? -1 };
  void second;
} else if (scenario === "concurrent-release") {
  const first = await acquire(limiter);
  const second = await acquire(limiter);
  clock = 2_000;
  await Promise.all([first.end, second.end]);
  result = { remaining: [...values.values()].reduce((a, b) => a + b, 0) };
} else if (scenario === "expired-release") {
  const first = await acquire(limiter);
  clock = 70_000;
  await first.end;
  result = { remaining: [...values.values()].reduce((a, b) => a + b, 0), recreated: values.size !== 0 };
} else if (scenario === "eval-error") {
  evalError = true;
  await acquire(limiter);
  result = { count: [...values.values()][0], releaseError: true };
} else if (scenario === "failed-response") {
  const first = await acquire(limiter, 500);
  await first.end;
  const second = await acquire(limiter);
  result = { first: first.status, second: second.status, count: [...values.values()][0] };
} else throw new Error(`unknown scenario ${scenario}`);
server.close();
console.log(`RESULT ${JSON.stringify(result)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
