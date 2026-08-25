import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "classroom-scope-test-jwt-secret";

const prisma = require("../src/lib/prisma").default as typeof import("../src/lib/prisma").default;
const classroomRoutes = require("../src/routes/classrooms").default as typeof import("../src/routes/classrooms").default;
const prismaClient = prisma as any;

async function requestAsTeacher(app: express.Express, path: string, init?: RequestInit) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const token = jwt.sign(
      { userId: "teacher-a", email: "teacher-a@school.test", role: "TEACHER", tv: 0 },
      process.env.JWT_SECRET!,
    );
    return await fetch(`http://127.0.0.1:${address.port}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

const teacher = {
  id: "teacher-a",
  email: "teacher-a@school.test",
  role: "TEACHER",
  status: "ACTIVE",
  tokenVersion: 0,
  emailVerified: true,
  schoolId: "school-a",
  school: { verified: true, ownershipStatus: "APPROVED" },
};

function installTeacherAuthMock() {
  const original = prismaClient.user.findUnique;
  prismaClient.user.findUnique = async ({ where }: any) => where.id === teacher.id ? teacher : null;
  return () => { prismaClient.user.findUnique = original; };
}

test("teacher cannot read another teacher's same-school classroom", async () => {
  const restoreUser = installTeacherAuthMock();
  const originalClassroom = prismaClient.classroom.findUnique;
  prismaClient.classroom.findUnique = async () => ({
    id: "classroom-b",
    name: "Other Teacher Class",
    schoolId: "school-a",
    teacherId: "teacher-b",
    teacher: { id: "teacher-b", name: "Teacher B" },
    students: [{
      id: "student-b",
      name: "Sensitive Student",
      email: "student-b@school.test",
      grade: "9",
      serviceSessions: [{ totalHours: 10 }],
    }],
    school: { id: "school-a" },
  });

  try {
    const app = express();
    app.use(express.json());
    app.use(classroomRoutes);
    const response = await requestAsTeacher(app, "/classroom-b");
    assert.equal(response.status, 404);
    assert.doesNotMatch(await response.text(), /Sensitive Student|student-b@school\.test/);
  } finally {
    restoreUser();
    prismaClient.classroom.findUnique = originalClassroom;
  }
});

test("teacher cannot mutate another teacher's same-school classroom", async () => {
  const restoreUser = installTeacherAuthMock();
  const original = {
    classroomFindUnique: prismaClient.classroom.findUnique,
    classroomUpdate: prismaClient.classroom.update,
  };
  let updateCount = 0;
  prismaClient.classroom.findUnique = async () => ({
    id: "classroom-b",
    name: "Other Teacher Class",
    schoolId: "school-a",
    teacherId: "teacher-b",
  });
  prismaClient.classroom.update = async () => {
    updateCount += 1;
    return { id: "classroom-b", name: "Changed" };
  };

  try {
    const app = express();
    app.use(express.json());
    app.use(classroomRoutes);
    const response = await requestAsTeacher(app, "/classroom-b", {
      method: "PUT",
      body: JSON.stringify({ name: "Changed" }),
    });
    assert.equal(response.status, 404);
    assert.equal(updateCount, 0);
  } finally {
    restoreUser();
    prismaClient.classroom.findUnique = original.classroomFindUnique;
    prismaClient.classroom.update = original.classroomUpdate;
  }
});

test("teacher cannot reassign their own classroom", async () => {
  const restoreUser = installTeacherAuthMock();
  const original = {
    classroomFindUnique: prismaClient.classroom.findUnique,
    classroomUpdate: prismaClient.classroom.update,
  };
  let updateCount = 0;
  prismaClient.classroom.findUnique = async () => ({
    id: "classroom-a",
    name: "Teacher A Class",
    schoolId: "school-a",
    teacherId: "teacher-a",
  });
  prismaClient.classroom.update = async () => {
    updateCount += 1;
    return { id: "classroom-a" };
  };

  try {
    const app = express();
    app.use(express.json());
    app.use(classroomRoutes);
    const response = await requestAsTeacher(app, "/classroom-a", {
      method: "PUT",
      body: JSON.stringify({ teacherId: "teacher-b" }),
    });
    assert.equal(response.status, 403);
    assert.equal(updateCount, 0);
  } finally {
    restoreUser();
    prismaClient.classroom.findUnique = original.classroomFindUnique;
    prismaClient.classroom.update = original.classroomUpdate;
  }
});
