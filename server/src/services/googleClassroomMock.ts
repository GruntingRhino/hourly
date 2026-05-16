export type GoogleClassroomMockScenario = "default" | "renamed" | "archived" | "deleted" | "student_removed";

export type GoogleClassroomMockCourse = {
  id: string;
  name: string;
  section?: string | null;
  workflowState: "ACTIVE" | "ARCHIVED" | "PROVISIONED" | "DECLINED" | "SUSPENDED";
};

export type GoogleClassroomMockUser = {
  id: string;
  name: string;
  email: string;
  role: "teacher" | "student";
};

export type GoogleClassroomMockEnrollment = {
  id: string;
  userId: string;
  courseId: string;
  role: "TeacherEnrollment" | "StudentEnrollment";
  workflowState: "active" | "inactive" | "deleted";
};

export type GoogleClassroomMockDataset = {
  scenario: GoogleClassroomMockScenario;
  courses: GoogleClassroomMockCourse[];
  users: GoogleClassroomMockUser[];
  enrollments: GoogleClassroomMockEnrollment[];
};

const BASE_USERS: GoogleClassroomMockUser[] = [
  { id: "gclass-teacher-1", name: "Google Classroom Teacher Alpha", email: "gclass.teacher.alpha@schoola.edu", role: "teacher" },
  { id: "gclass-teacher-2", name: "Google Classroom Teacher Beta", email: "gclass.teacher.beta@schoola.edu", role: "teacher" },
  { id: "gclass-student-existing", name: "PW Existing Classroom Student", email: "abhay.sivaram+8@gmail.com", role: "student" },
  { id: "gclass-student-new-1", name: "Google Classroom Student One", email: "gclass.student.one@schoola.edu", role: "student" },
  { id: "gclass-student-new-2", name: "Google Classroom Student Two", email: "gclass.student.two@schoola.edu", role: "student" },
  { id: "gclass-student-dup-a", name: "Google Classroom Duplicate A", email: "gclass.duplicate@schoola.edu", role: "student" },
  { id: "gclass-student-dup-b", name: "Google Classroom Duplicate B", email: "gclass.duplicate@schoola.edu", role: "student" },
];

function buildDefaultDataset(): GoogleClassroomMockDataset {
  return {
    scenario: "default",
    courses: [
      { id: "gclass-course-bio", name: "Google Classroom Biology 101", section: "Period 1", workflowState: "ACTIVE" },
      { id: "gclass-course-service", name: "Google Classroom Service Lab", section: "Advisory", workflowState: "ACTIVE" },
    ],
    users: BASE_USERS,
    enrollments: [
      { id: "teacher:gclass-course-bio:gclass-teacher-1", userId: "gclass-teacher-1", courseId: "gclass-course-bio", role: "TeacherEnrollment", workflowState: "active" },
      { id: "teacher:gclass-course-service:gclass-teacher-2", userId: "gclass-teacher-2", courseId: "gclass-course-service", role: "TeacherEnrollment", workflowState: "active" },
      { id: "student:gclass-course-bio:gclass-student-existing", userId: "gclass-student-existing", courseId: "gclass-course-bio", role: "StudentEnrollment", workflowState: "active" },
      { id: "student:gclass-course-bio:gclass-student-new-1", userId: "gclass-student-new-1", courseId: "gclass-course-bio", role: "StudentEnrollment", workflowState: "active" },
      { id: "student:gclass-course-service:gclass-student-new-2", userId: "gclass-student-new-2", courseId: "gclass-course-service", role: "StudentEnrollment", workflowState: "active" },
      { id: "student:gclass-course-bio:gclass-student-dup-a", userId: "gclass-student-dup-a", courseId: "gclass-course-bio", role: "StudentEnrollment", workflowState: "active" },
      { id: "student:gclass-course-service:gclass-student-dup-b", userId: "gclass-student-dup-b", courseId: "gclass-course-service", role: "StudentEnrollment", workflowState: "active" },
    ],
  };
}

function buildRenamedDataset(): GoogleClassroomMockDataset {
  return {
    ...buildDefaultDataset(),
    scenario: "renamed",
    courses: [
      { id: "gclass-course-bio", name: "Google Classroom Biology Honors", section: "Block A", workflowState: "ACTIVE" },
      { id: "gclass-course-service", name: "Google Classroom Service Lab", section: "Advisory", workflowState: "ACTIVE" },
    ],
  };
}

function buildArchivedDataset(): GoogleClassroomMockDataset {
  return {
    ...buildDefaultDataset(),
    scenario: "archived",
    courses: [
      { id: "gclass-course-bio", name: "Google Classroom Biology 101", section: "Period 1", workflowState: "ACTIVE" },
      { id: "gclass-course-service", name: "Google Classroom Service Lab", section: "Advisory", workflowState: "ARCHIVED" },
    ],
  };
}

function buildDeletedDataset(): GoogleClassroomMockDataset {
  return {
    ...buildDefaultDataset(),
    scenario: "deleted",
    courses: [{ id: "gclass-course-service", name: "Google Classroom Service Lab", section: "Advisory", workflowState: "ACTIVE" }],
    enrollments: buildDefaultDataset().enrollments.filter((enrollment) => enrollment.courseId !== "gclass-course-bio"),
  };
}

function buildStudentRemovedDataset(): GoogleClassroomMockDataset {
  return {
    ...buildDefaultDataset(),
    scenario: "student_removed",
    enrollments: buildDefaultDataset().enrollments.filter((enrollment) => enrollment.id !== "student:gclass-course-bio:gclass-student-new-1"),
  };
}

export function getGoogleClassroomMockDataset(scenario: GoogleClassroomMockScenario): GoogleClassroomMockDataset {
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
