export type SignupQuestionType = "TEXT" | "NUMBER" | "BOOLEAN" | "DATE";
export interface SignupQuestion { id: string; label: string; type: SignupQuestionType; required: boolean; }
const MAX_QUESTIONS = 10;
const MAX_TEXT = 500;
export function validateSignupTemplate(questions: SignupQuestion[]): SignupQuestion[] {
  if (questions.length > MAX_QUESTIONS) throw new Error("Too many signup questions");
  const ids = new Set<string>();
  return questions.map((question) => {
    if (!question.id || ids.has(question.id) || !question.label.trim()) throw new Error("Invalid signup question");
    ids.add(question.id);
    if (!["TEXT", "NUMBER", "BOOLEAN", "DATE"].includes(question.type)) throw new Error("Unsupported signup question type");
    return { ...question, label: question.label.trim() };
  });
}
export function validateSignupAnswers(template: SignupQuestion[], answers: Record<string, unknown>): Record<string, unknown> {
  const valid = validateSignupTemplate(template);
  const output: Record<string, unknown> = {};
  for (const question of valid) {
    const value = answers[question.id];
    if (question.required && (value === undefined || value === null || value === "")) throw new Error(`Missing answer: ${question.id}`);
    if (value === undefined) continue;
    if (question.type === "TEXT" && (typeof value !== "string" || value.length > MAX_TEXT)) throw new Error(`Invalid answer: ${question.id}`);
    if (question.type === "NUMBER" && (typeof value !== "number" || !Number.isFinite(value))) throw new Error(`Invalid answer: ${question.id}`);
    if (question.type === "BOOLEAN" && typeof value !== "boolean") throw new Error(`Invalid answer: ${question.id}`);
    if (question.type === "DATE" && (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))) throw new Error(`Invalid answer: ${question.id}`);
    output[question.id] = value;
  }
  return output;
}
