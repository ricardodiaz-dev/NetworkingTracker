import { z } from "zod";

export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const SORT_FIELDS = ["name", "company", "priority", "created_at"] as const;
export type SortField = (typeof SORT_FIELDS)[number];

/**
 * z.custom rather than z.enum so the message is exact and stable across zod versions,
 * instead of leaking a generated "expected one of..." string to the user.
 */
const prioritySchema = z.custom<Priority>(
  (value) =>
    typeof value === "string" && (PRIORITIES as readonly string[]).includes(value),
  { message: "Priority must be one of: high, medium, low." },
);

const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(120, "Name must be 120 characters or fewer.");

/** Trims, and normalises blank input to null so the column stores NULL rather than "". */
const optionalText = (label: string, max: number) =>
  z
    .union([z.string(), z.null()])
    .transform((value) => {
      const trimmed = (value ?? "").trim();
      return trimmed === "" ? null : trimmed;
    })
    .refine(
      (value) => value === null || value.length <= max,
      `${label} must be ${max} characters or fewer.`,
    );

/**
 * user_id is intentionally absent. Zod strips unknown keys, so a client cannot smuggle
 * one in; the column is filled by its `default auth.user_id()` and guarded by RLS.
 */
export const createContactSchema = z.object({
  name: nameSchema,
  company: optionalText("Company", 120).default(null),
  role: optionalText("Role", 120).default(null),
  met_at: optionalText("Where you met", 200).default(null),
  notes: optionalText("Notes", 2000).default(null),
  priority: prioritySchema,
});

export const updateContactSchema = z.object({
  name: nameSchema.optional(),
  company: optionalText("Company", 120).optional(),
  role: optionalText("Role", 120).optional(),
  met_at: optionalText("Where you met", 200).optional(),
  notes: optionalText("Notes", 2000).optional(),
  priority: prioritySchema.optional(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

export type FieldErrors = Record<string, string>;

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: FieldErrors };

/** First error per field — the UI shows one message under each input. */
function toFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (!(field in errors)) errors[field] = issue.message;
  }
  return errors;
}

export function parseCreateContact(input: unknown): ParseResult<CreateContactInput> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: { form: "Request body must be a JSON object." } };
  }
  const result = createContactSchema.safeParse(input);
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, errors: toFieldErrors(result.error) };
}

/**
 * PATCH semantics: only keys actually present in the request are returned, so omitting
 * a field leaves it untouched while explicitly sending null clears it.
 */
export function parseUpdateContact(input: unknown): ParseResult<UpdateContactInput> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: { form: "Request body must be a JSON object." } };
  }

  const result = updateContactSchema.safeParse(input);
  if (!result.success) {
    return { ok: false, errors: toFieldErrors(result.error) };
  }

  const provided = new Set(Object.keys(input as Record<string, unknown>));
  const data = Object.fromEntries(
    Object.entries(result.data).filter(([key]) => provided.has(key)),
  ) as UpdateContactInput;

  if (Object.keys(data).length === 0) {
    return { ok: false, errors: { form: "Provide at least one field to update." } };
  }

  return { ok: true, data };
}

export function parseSort(field: string | null, direction: string | null) {
  const sortField: SortField = (SORT_FIELDS as readonly string[]).includes(field ?? "")
    ? (field as SortField)
    : "created_at";

  // priority sorts on the generated rank column so high < medium < low.
  const column = sortField === "priority" ? "priority_rank" : sortField;
  const ascending = direction === "asc";

  return { sortField, column, ascending };
}

export function parsePriorityFilter(value: string | null): Priority | null {
  return value && (PRIORITIES as readonly string[]).includes(value)
    ? (value as Priority)
    : null;
}
