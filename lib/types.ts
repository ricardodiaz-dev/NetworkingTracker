import type { Priority } from "@/lib/validation";

export type Contact = {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  role: string | null;
  met_at: string | null;
  notes: string | null;
  priority: Priority;
  created_at: string;
  updated_at: string;
};

/** Shape returned by every /api/contacts failure, consumed by the UI. */
export type ApiError = {
  error: string;
  fields?: Record<string, string>;
};
