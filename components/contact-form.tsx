"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Spinner } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import type { Contact } from "@/lib/types";
import { PRIORITIES, type Priority } from "@/lib/validation";

export type ContactDraft = {
  name: string;
  company: string;
  role: string;
  met_at: string;
  notes: string;
  priority: Priority;
};

const emptyDraft: ContactDraft = {
  name: "",
  company: "",
  role: "",
  met_at: "",
  notes: "",
  priority: "medium",
};

function toDraft(contact: Contact | null): ContactDraft {
  if (!contact) return emptyDraft;
  return {
    name: contact.name,
    company: contact.company ?? "",
    role: contact.role ?? "",
    met_at: contact.met_at ?? "",
    notes: contact.notes ?? "",
    priority: contact.priority,
  };
}

export function ContactForm({
  open,
  editing,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: Contact | null;
  onClose: () => void;
  onSubmit: (draft: ContactDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ContactDraft>(emptyDraft);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(toDraft(editing));
      setFieldErrors({});
      setFormError(null);
    }
  }, [open, editing]);

  function update<K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setSaving(true);

    try {
      await onSubmit(draft);
    } catch (caught) {
      // The server is the source of truth for validation; surface exactly what it said.
      const error = caught as Error & { fields?: Record<string, string> };
      if (error.fields) setFieldErrors(error.fields);
      setFormError(error.message ?? "Could not save that contact.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit contact" : "Add contact"}
    >
      <h2 className="text-lg font-semibold">
        {editing ? "Edit contact" : "Add contact"}
      </h2>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4" noValidate>
        <Field label="Name" htmlFor="contact-name" error={fieldErrors.name}>
          <Input
            id="contact-name"
            value={draft.name}
            aria-invalid={Boolean(fieldErrors.name)}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Ada Lovelace"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company" htmlFor="contact-company" error={fieldErrors.company}>
            <Input
              id="contact-company"
              value={draft.company}
              onChange={(event) => update("company", event.target.value)}
              placeholder="Acme Robotics"
            />
          </Field>

          <Field label="Role" htmlFor="contact-role" error={fieldErrors.role}>
            <Input
              id="contact-role"
              value={draft.role}
              onChange={(event) => update("role", event.target.value)}
              placeholder="Engineering Manager"
            />
          </Field>
        </div>

        <Field label="Where you met" htmlFor="contact-met-at" error={fieldErrors.met_at}>
          <Input
            id="contact-met-at"
            value={draft.met_at}
            onChange={(event) => update("met_at", event.target.value)}
            placeholder="Berkeley AI Hackathon"
          />
        </Field>

        <Field label="Priority" htmlFor="contact-priority" error={fieldErrors.priority}>
          <Select
            id="contact-priority"
            value={draft.priority}
            aria-invalid={Boolean(fieldErrors.priority)}
            onChange={(event) => update("priority", event.target.value as Priority)}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority.charAt(0).toUpperCase() + priority.slice(1)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Notes" htmlFor="contact-notes" error={fieldErrors.notes}>
          <Textarea
            id="contact-notes"
            value={draft.notes}
            onChange={(event) => update("notes", event.target.value)}
            placeholder="What did you talk about? What should you follow up on?"
          />
        </Field>

        {formError && <Alert>{formError}</Alert>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Spinner />}
            {editing ? "Save changes" : "Add contact"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
