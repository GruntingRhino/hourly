import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { createEmailSendRateLimit } from "../src/middleware/rateLimit";

type Middleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

function request(ip: string, email: string): Request {
  return {
    ip,
    body: { email },
    get: () => undefined,
    headers: {},
  } as unknown as Request;
}

async function invoke(middleware: Middleware, req: Request): Promise<{ status: number; body: unknown }> {
  let status = 200;
  let body: unknown;

  const res = {
    setHeader: () => undefined,
    status: (code: number) => {
      status = code;
      return res;
    },
    json: (payload: unknown) => {
      body = payload;
      return res;
    },
  } as unknown as Response;

  let nextCalled = false;
  await middleware(req, res, (() => { nextCalled = true; }) as NextFunction);
  return { status: nextCalled ? 200 : status, body };
}

test("email send limiter allows only one request per recipient every 60 seconds", async () => {
  const limiter = createEmailSendRateLimit({
    namespace: `email-recipient-${Date.now()}-${Math.random()}`,
    suspiciousIpNamespace: `email-recipient-ip-${Date.now()}-${Math.random()}`,
    recipientKey: (req: Request) => req.body.email,
  });

  assert.equal((await invoke(limiter, request("198.51.100.1", "student@example.edu"))).status, 200);

  const blocked = await invoke(limiter, request("198.51.100.2", "student@example.edu"));
  assert.equal(blocked.status, 429);
  assert.deepEqual({
    ...(blocked.body as Record<string, unknown>),
    retryAfterSeconds: undefined,
  }, {
    error: "Please wait 60 seconds before requesting another email.",
    code: "RATE_LIMITED",
    retryAfterSeconds: undefined,
  });
  const retryAfterSeconds = (blocked.body as { retryAfterSeconds: number }).retryAfterSeconds;
  assert.ok(retryAfterSeconds >= 1 && retryAfterSeconds <= 60);
});

test("email send limiter blocks suspicious bursts from one IP across recipients", async () => {
  const limiter = createEmailSendRateLimit({
    namespace: `email-ip-${Date.now()}-${Math.random()}`,
    suspiciousIpNamespace: `email-ip-burst-${Date.now()}-${Math.random()}`,
    recipientKey: (req: Request) => req.body.email,
  });

  for (let index = 0; index < 10; index += 1) {
    assert.equal(
      (await invoke(limiter, request("203.0.113.7", `student-${index}@example.edu`))).status,
      200
    );
  }

  const blocked = await invoke(limiter, request("203.0.113.7", "student-10@example.edu"));
  assert.equal(blocked.status, 429);
  assert.deepEqual(blocked.body, {
    error: "Too many email requests from this IP. Please try again later.",
    code: "RATE_LIMITED",
    retryAfterSeconds: 900,
  });
});

test("email send limiter shares suspicious-IP detection across email workflows", async () => {
  const firstWorkflow = createEmailSendRateLimit({
    namespace: `email-first-workflow-${Date.now()}-${Math.random()}`,
    recipientKey: (req: Request) => req.body.email,
  });
  const secondWorkflow = createEmailSendRateLimit({
    namespace: `email-second-workflow-${Date.now()}-${Math.random()}`,
    recipientKey: (req: Request) => req.body.email,
  });

  for (let index = 0; index < 10; index += 1) {
    assert.equal(
      (await invoke(firstWorkflow, request("192.0.2.42", `student-${index}@example.edu`))).status,
      200
    );
  }

  assert.equal(
    (await invoke(secondWorkflow, request("192.0.2.42", "another-student@example.edu"))).status,
    429
  );
});
