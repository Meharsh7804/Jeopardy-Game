import type { Quiz, Category, Question } from "../types/jeopardy";

export interface QuizValidationIssue {
  level: "error" | "warning";
  message: string;
  path?: string;
}

const isNonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

export function validateQuiz(quiz: Quiz): QuizValidationIssue[] {
  const issues: QuizValidationIssue[] = [];

  if (!isNonEmpty(quiz.title)) issues.push({ level: "error", message: "Quiz title is required.", path: "title" });
  if (!Array.isArray(quiz.categories) || quiz.categories.length === 0) {
    issues.push({ level: "error", message: "Add at least one category.", path: "categories" });
    return issues;
  }

  const seenCatNames = new Set<string>();
  quiz.categories.forEach((cat: Category, ci: number) => {
    const catPath = `categories[${ci}]`;
    if (!isNonEmpty(cat.name)) issues.push({ level: "error", message: `Category ${ci + 1} needs a name.`, path: `${catPath}.name` });
    const key = (cat.name || "").trim().toLowerCase();
    if (key) {
      if (seenCatNames.has(key)) issues.push({ level: "warning", message: `Duplicate category name "${cat.name}".`, path: `${catPath}.name` });
      seenCatNames.add(key);
    }
    if (!Array.isArray(cat.questions) || cat.questions.length === 0) {
      issues.push({ level: "error", message: `Category "${cat.name || ci + 1}" has no questions.`, path: `${catPath}.questions` });
      return;
    }
    const seenValues = new Set<number>();
    cat.questions.forEach((q: Question, qi: number) => {
      const qPath = `${catPath}.questions[${qi}]`;
      if (!isNonEmpty(q.text)) issues.push({ level: "warning", message: `Question ${qi + 1} in "${cat.name}" is empty.`, path: `${qPath}.text` });
      if (!isNonEmpty(q.answer)) issues.push({ level: "warning", message: `Answer missing for Q${qi + 1} in "${cat.name}".`, path: `${qPath}.answer` });
      if (!Number.isFinite(q.value) || q.value <= 0) issues.push({ level: "error", message: `Question value must be positive in "${cat.name}".`, path: `${qPath}.value` });
      if (seenValues.has(q.value)) issues.push({ level: "warning", message: `Duplicate value $${q.value} in "${cat.name}".`, path: `${qPath}.value` });
      seenValues.add(q.value);
      if (q.type !== "text" && !isNonEmpty(q.mediaUrl)) {
        issues.push({ level: "warning", message: `Media URL missing for ${q.type} question in "${cat.name}".`, path: `${qPath}.mediaUrl` });
      }
    });
  });

  return issues;
}

export function hasBlockingErrors(issues: QuizValidationIssue[]): boolean {
  return issues.some((i) => i.level === "error");
}