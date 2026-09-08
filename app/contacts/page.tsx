"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ContactFilters, type Filters } from "@/components/contact-filters";
import { ContactForm, type ContactDraft } from "@/components/contact-form";
import { ContactList } from "@/components/contact-list";
import { Button } from "@/components/ui/button";
import { Alert, Card, Spinner } from "@/components/ui/misc";
import { apiFetch } from "@/lib/neon/browser";
import type { Contact } from "@/lib/types";
import { useSession } from "@/lib/use-session";

type LoadState = "loading" | "ready" | "error";

export default function ContactsPage() {
  const router = useRouter();
  const { session, signOut } = useSession();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);

  const [filters, setFilters] = useState<Filters>({
    search: "",
    priority: "all",
    sort: "created_at",
    direction: "desc",
  });

  useEffect(() => {
    if (session.status === "signed-out") router.replace("/sign-in");
  }, [session.status, router]);

  const load = useCallback(async () => {
    setLoadState("loading");
    setLoadError(null);

    const params = new URLSearchParams({
      sort: filters.sort,
      direction: filters.direction,
    });
    if (filters.priority !== "all") params.set("priority", filters.priority);
    if (filters.search.trim()) params.set("search", filters.search.trim());

    try {
      const data = await apiFetch<{ contacts: Contact[] }>(
        `/api/contacts?${params}`,
      );
      setContacts(data.contacts);
      setLoadState("ready");
    } catch (caught) {
      setLoadError(
        caught instanceof Error ? caught.message : "Could not load your contacts.",
      );
      setLoadState("error");
    }
  }, [filters]);

  useEffect(() => {
    if (session.status !== "signed-in") return;

    // Debounced so typing in the search box does not fire a request per keystroke.
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [session.status, load]);

  async function handleSubmit(draft: ContactDraft) {
    const body = JSON.stringify(draft);

    if (editing) {
      const { contact } = await apiFetch<{ contact: Contact }>(
        `/api/contacts/${editing.id}`,
        { method: "PATCH", body },
      );
      setContacts((current) =>
        current.map((item) => (item.id === contact.id ? contact : item)),
      );
      setNotice(`Saved changes to ${contact.name}.`);
    } else {
      await apiFetch<{ contact: Contact }>("/api/contacts", {
        method: "POST",
        body,
      });
      setNotice("Contact added.");
      await load();
    }

    setFormOpen(false);
    setEditing(null);
  }

  async function handleDelete(contact: Contact) {
    if (!window.confirm(`Delete ${contact.name}? This cannot be undone.`)) return;

    setDeletingId(contact.id);
    setNotice(null);
    try {
      await apiFetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
      setContacts((current) => current.filter((item) => item.id !== contact.id));
      setNotice(`Deleted ${contact.name}.`);
    } catch (caught) {
      setLoadError(
        caught instanceof Error ? caught.message : "Could not delete that contact.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  if (session.status !== "signed-in") {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="text-muted-foreground" />
      </main>
    );
  }

  const filtersActive = filters.search.trim() !== "" || filters.priority !== "all";

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">My contacts</h1>
          <p className="truncate text-sm text-muted-foreground">{session.email}</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Add contact
          </Button>
          <Button variant="outline" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </header>

      <div className="mt-6">
        <ContactFilters
          filters={filters}
          onChange={(next) => setFilters((current) => ({ ...current, ...next }))}
        />
      </div>

      {notice && (
        <div className="mt-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      )}

      <div className="mt-6">
        {loadState === "loading" && (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Spinner />
            Loading your contacts…
          </div>
        )}

        {loadState === "error" && (
          <div className="flex flex-col items-start gap-3">
            <Alert>{loadError}</Alert>
            <Button variant="outline" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        )}

        {loadState === "ready" && contacts.length === 0 && (
          <Card className="px-6 py-16 text-center">
            <p className="font-medium">
              {filtersActive ? "No contacts match those filters" : "No contacts yet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtersActive
                ? "Try clearing the search box or choosing a different priority."
                : "Add the first person you want to stay connected with."}
            </p>
            {!filtersActive && (
              <Button
                className="mt-5"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                Add contact
              </Button>
            )}
          </Card>
        )}

        {loadState === "ready" && contacts.length > 0 && (
          <ContactList
            contacts={contacts}
            sort={filters.sort}
            direction={filters.direction}
            deletingId={deletingId}
            onSort={(field) =>
              setFilters((current) => ({
                ...current,
                sort: field,
                direction:
                  current.sort === field && current.direction === "asc"
                    ? "desc"
                    : "asc",
              }))
            }
            onEdit={(contact) => {
              setEditing(contact);
              setFormOpen(true);
            }}
            onDelete={handleDelete}
          />
        )}
      </div>

      <ContactForm
        open={formOpen}
        editing={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />
    </main>
  );
}
