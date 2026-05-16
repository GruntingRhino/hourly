export type CanvasMockScenario = "default" | "renamed" | "archived" | "deleted" | "student_removed";

export type CanvasMockCourse = {
  id: string;
  name: string;
  workflowState: "available" | "completed" | "deleted";
};

export type CanvasMockSection = {
  id: string;
  courseId: string;
  name: string;
  workflowState: "active" | "completed" | "deleted";
};

export type CanvasMockUser = {
  id: string;
  name: string;
  email: string;
  role: "teacher" | "student";
};

export type CanvasMockEnrollment = {
  id: string;
  userId: string;
  sectionId: string;
  role: "TeacherEnrollment" | "StudentEnrollment";
  workflowState: "active" | "inactive" | "deleted";
};

export type CanvasMockDataset = {
  scenario: CanvasMockScenario;
  courses: CanvasMockCourse[];
  sections: CanvasMockSection[];
  users: CanvasMockUser[];
  enrollments: CanvasMockEnrollment[];
};

const BASE_USERS: CanvasMockUser[] = [
  { id: "canvas-teacher-1", name: "Canvas Teacher Alpha", email: "canvas.teacher.alpha@schoola.edu", role: "teacher" },
  { id: "canvas-teacher-2", name: "Canvas Teacher Beta", email: "canvas.teacher.beta@schoola.edu", role: "teacher" },
  { id: "canvas-student-existing", name: "PW Existing Canvas Student", email: "abhay.sivaram+8@gmail.com", role: "student" },
  { id: "canvas-student-new-1", name: "Canvas Student One", email: "canvas.student.one@schoola.edu", role: "student" },
  { id: "canvas-student-new-2", name: "Canvas Student Two", email: "canvas.student.two@schoola.edu", role: "student" },
  { id: "canvas-student-dup-a", name: "Canvas Duplicate A", email: "canvas.duplicate@schoola.edu", role: "student" },
  { id: "canvas-student-dup-b", name: "Canvas Duplicate B", email: "canvas.duplicate@schoola.edu", role: "student" },
];

function buildDefaultDataset(): CanvasMockDataset {
  return {
    scenario: "default",
    courses: [
      { id: "canvas-course-bio", name: "Canvas Biology 101", workflowState: "available" },
      { id: "canvas-course-service", name: "Canvas Service Lab", workflowState: "available" },
    ],
    sections: [
      { id: "canvas-section-bio-p1", courseId: "canvas-course-bio", name: "Period 1", workflowState: "active" },
      { id: "canvas-section-bio-p2", courseId: "canvas-course-bio", name: "Period 2", workflowState: "active" },
      { id: "canvas-section-service-advisory", courseId: "canvas-course-service", name: "Advisory", workflowState: "active" },
    ],
    users: BASE_USERS,
    enrollments: [
      { id: "e1", userId: "canvas-teacher-1", sectionId: "canvas-section-bio-p1", role: "TeacherEnrollment", workflowState: "active" },
      { id: "e2", userId: "canvas-teacher-1", sectionId: "canvas-section-bio-p2", role: "TeacherEnrollment", workflowState: "active" },
      { id: "e3", userId: "canvas-teacher-2", sectionId: "canvas-section-service-advisory", role: "TeacherEnrollment", workflowState: "active" },
      { id: "e4", userId: "canvas-student-existing", sectionId: "canvas-section-bio-p1", role: "StudentEnrollment", workflowState: "active" },
      { id: "e5", userId: "canvas-student-new-1", sectionId: "canvas-section-bio-p1", role: "StudentEnrollment", workflowState: "active" },
      { id: "e6", userId: "canvas-student-new-2", sectionId: "canvas-section-service-advisory", role: "StudentEnrollment", workflowState: "active" },
      { id: "e7", userId: "canvas-student-dup-a", sectionId: "canvas-section-bio-p2", role: "StudentEnrollment", workflowState: "active" },
      { id: "e8", userId: "canvas-student-dup-b", sectionId: "canvas-section-service-advisory", role: "StudentEnrollment", workflowState: "active" },
    ],
  };
}

function buildRenamedDataset(): CanvasMockDataset {
  return {
    ...buildDefaultDataset(),
    scenario: "renamed",
    courses: [
      { id: "canvas-course-bio", name: "Canvas Biology Honors", workflowState: "available" },
      { id: "canvas-course-service", name: "Canvas Service Lab", workflowState: "available" },
    ],
    sections: [
      { id: "canvas-section-bio-p1", courseId: "canvas-course-bio", name: "Period Red", workflowState: "active" },
      { id: "canvas-section-bio-p2", courseId: "canvas-course-bio", name: "Period Blue", workflowState: "active" },
      { id: "canvas-section-service-advisory", courseId: "canvas-course-service", name: "Advisory", workflowState: "active" },
    ],
  };
}

function buildArchivedDataset(): CanvasMockDataset {
  return {
    ...buildDefaultDataset(),
    scenario: "archived",
    courses: [
      { id: "canvas-course-bio", name: "Canvas Biology 101", workflowState: "available" },
      { id: "canvas-course-service", name: "Canvas Service Lab", workflowState: "completed" },
    ],
    sections: [
      { id: "canvas-section-bio-p1", courseId: "canvas-course-bio", name: "Period 1", workflowState: "active" },
      { id: "canvas-section-bio-p2", courseId: "canvas-course-bio", name: "Period 2", workflowState: "active" },
      { id: "canvas-section-service-advisory", courseId: "canvas-course-service", name: "Advisory", workflowState: "completed" },
    ],
  };
}

function buildDeletedDataset(): CanvasMockDataset {
  return {
    ...buildDefaultDataset(),
    scenario: "deleted",
    sections: [
      { id: "canvas-section-bio-p1", courseId: "canvas-course-bio", name: "Period 1", workflowState: "active" },
      { id: "canvas-section-service-advisory", courseId: "canvas-course-service", name: "Advisory", workflowState: "active" },
    ],
    enrollments: buildDefaultDataset().enrollments.filter((enrollment) => enrollment.sectionId !== "canvas-section-bio-p2"),
  };
}

function buildStudentRemovedDataset(): CanvasMockDataset {
  return {
    ...buildDefaultDataset(),
    scenario: "student_removed",
    enrollments: buildDefaultDataset().enrollments.filter((enrollment) => enrollment.id !== "e5"),
  };
}

export function getCanvasMockDataset(scenario: CanvasMockScenario): CanvasMockDataset {
  switch (scenario) {
    case "renamed":
      return buildRenamedDataset();
    case "archived":
      return buildArchivedDataset();
    case "deleted":
      return buildDeletedDataset();
    case "student_removed":
      return buildStudentRemovedDataset();
    case "default":
    default:
      return buildDefaultDataset();
  }
}
