"use client";

import { Button } from "@/components/ui/button";
import { Card, PriorityBadge } from "@/components/ui/misc";
import type { Contact } from "@/lib/types";
import { SORT_FIELDS, type SortField } from "@/lib/validation";

const COLUMN_LABELS: Record<SortField, string> = {
  name: "Name",
  company: "Company",
  priority: "Priority",
  created_at: "Added",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SortButton({
  field,
  sort,
  direction,
  onSort,
}: {
  field: SortField;
  sort: SortField;
  direction: "asc" | "desc";
  onSort: (field: SortField) => void;
}) {
  const active = sort === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
      aria-label={`Sort by ${COLUMN_LABELS[field]}`}
    >
      {COLUMN_LABELS[field]}
      <span aria-hidden className={active ? "opacity-100" : "opacity-25"}>
        {active && direction === "asc" ? "↑" : "↓"}
      </span>
    </button>
  );
}

export function ContactList({
  contacts,
  sort,
  direction,
  onSort,
  onEdit,
  onDelete,
  deletingId,
}: {
  contacts: Contact[];
  sort: SortField;
  direction: "asc" | "desc";
  onSort: (field: SortField) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
  deletingId: string | null;
}) {
  return (
    <>
      {/* Mobile: stacked cards. A 7-column table is unusable on a phone. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {contacts.map((contact) => (
          <li key={contact.id}>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{contact.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[contact.role, contact.company].filter(Boolean).join(" · ") ||
                      "No company or role"}
                  </p>
                </div>
                <PriorityBadge priority={contact.priority} />
              </div>

              {contact.met_at && (
                <p className="mt-3 text-sm">
                  <span className="text-muted-foreground">Met at </span>
                  {contact.met_at}
                </p>
              )}
              {contact.notes && (
                <p className="mt-1 text-sm text-muted-foreground">{contact.notes}</p>
              )}

              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => onEdit(contact)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={deletingId === contact.id}
                  onClick={() => onDelete(contact)}
                >
                  {deletingId === contact.id ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {/* Desktop: full table with sortable headers. */}
      <Card className="hidden overflow-hidden md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted text-muted-foreground">
            <tr>
              {SORT_FIELDS.filter((field) => field !== "created_at").map((field) => (
                <th key={field} scope="col" className="px-4 py-3">
                  <SortButton
                    field={field}
                    sort={sort}
                    direction={direction}
                    onSort={onSort}
                  />
                </th>
              ))}
              <th scope="col" className="px-4 py-3 font-medium">
                Where you met
              </th>
              <th scope="col" className="px-4 py-3">
                <SortButton
                  field="created_at"
                  sort={sort}
                  direction={direction}
                  onSort={onSort}
                />
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr key={contact.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{contact.name}</div>
                  {contact.notes && (
                    <div className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground">
                      {contact.notes}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">{contact.company ?? "—"}</td>
                <td className="px-4 py-3">
                  <PriorityBadge priority={contact.priority} />
                </td>
                <td className="px-4 py-3">{contact.met_at ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDate(contact.created_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => onEdit(contact)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={deletingId === contact.id}
                      onClick={() => onDelete(contact)}
                    >
                      {deletingId === contact.id ? "Deleting…" : "Delete"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
