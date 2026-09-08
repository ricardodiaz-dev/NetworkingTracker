import { describe, expect, it } from "vitest";

import {
  PRIORITIES,
  parseCreateContact,
  parsePriorityFilter,
  parseSort,
  parseUpdateContact,
} from "@/lib/validation";

const validContact = {
  name: "Ada Lovelace",
  company: "Analytical Engines",
  role: "Mathematician",
  met_at: "Berkeley AI Hackathon",
  notes: "Follow up about the notes on Bernoulli numbers.",
  priority: "high",
};

describe("parseCreateContact", () => {
  it("accepts a fully populated contact", () => {
    const result = parseCreateContact(validContact);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe("Ada Lovelace");
    expect(result.data.priority).toBe("high");
  });

  it("rejects an empty name with a clear message", () => {
    const result = parseCreateContact({ ...validContact, name: "" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBe("Name is required.");
  });

  it("rejects a whitespace-only name", () => {
    const result = parseCreateContact({ ...validContact, name: "   \t  " });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBe("Name is required.");
  });

  it("rejects a missing name", () => {
    const { name: _omitted, ...withoutName } = validContact;
    const result = parseCreateContact(withoutName);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBeDefined();
  });

  it("rejects an invalid priority with a clear message", () => {
    const result = parseCreateContact({ ...validContact, priority: "urgent" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.priority).toBe("Priority must be one of: high, medium, low.");
  });

  it.each(PRIORITIES)("accepts the '%s' priority", (priority) => {
    const result = parseCreateContact({ ...validContact, priority });

    expect(result.ok).toBe(true);
  });

  it("rejects a non-string priority", () => {
    const result = parseCreateContact({ ...validContact, priority: 1 });

    expect(result.ok).toBe(false);
  });

  it("trims the name and normalises blank optional fields to null", () => {
    const result = parseCreateContact({
      name: "  Grace Hopper  ",
      company: "   ",
      role: "",
      met_at: null,
      notes: "  Met at the compiler talk.  ",
      priority: "low",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe("Grace Hopper");
    expect(result.data.company).toBeNull();
    expect(result.data.role).toBeNull();
    expect(result.data.met_at).toBeNull();
    expect(result.data.notes).toBe("Met at the compiler talk.");
  });

  it("defaults omitted optional fields to null", () => {
    const result = parseCreateContact({ name: "Solo Field", priority: "medium" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.company).toBeNull();
    expect(result.data.notes).toBeNull();
  });

  it("rejects an over-long name", () => {
    const result = parseCreateContact({ ...validContact, name: "a".repeat(121) });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBe("Name must be 120 characters or fewer.");
  });

  it("strips user_id so a client cannot choose the owner of a row", () => {
    const result = parseCreateContact({ ...validContact, user_id: "someone-else" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).not.toHaveProperty("user_id");
  });

  it("rejects non-object bodies", () => {
    expect(parseCreateContact(null).ok).toBe(false);
    expect(parseCreateContact("nope").ok).toBe(false);
    expect(parseCreateContact([validContact]).ok).toBe(false);
  });
});

describe("parseUpdateContact", () => {
  it("returns only the fields that were actually sent", () => {
    const result = parseUpdateContact({ priority: "low" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({ priority: "low" });
    expect(result.data).not.toHaveProperty("name");
  });

  it("preserves an explicit null so a field can be cleared", () => {
    const result = parseUpdateContact({ notes: null });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({ notes: null });
  });

  it("rejects an empty patch", () => {
    const result = parseUpdateContact({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.form).toBe("Provide at least one field to update.");
  });

  it("rejects blanking a name that is being updated", () => {
    const result = parseUpdateContact({ name: "  " });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBe("Name is required.");
  });

  it("rejects an invalid priority", () => {
    const result = parseUpdateContact({ priority: "critical" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.priority).toBe("Priority must be one of: high, medium, low.");
  });

  it("strips user_id so a row cannot be reassigned to another user", () => {
    const result = parseUpdateContact({ name: "Renamed", user_id: "someone-else" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({ name: "Renamed" });
  });

  it("rejects a patch containing only unknown keys", () => {
    const result = parseUpdateContact({ user_id: "someone-else" });

    expect(result.ok).toBe(false);
  });
});

describe("parseSort", () => {
  it("defaults to newest first", () => {
    expect(parseSort(null, null)).toEqual({
      sortField: "created_at",
      column: "created_at",
      ascending: false,
    });
  });

  it("maps priority onto the generated rank column", () => {
    expect(parseSort("priority", "asc")).toEqual({
      sortField: "priority",
      column: "priority_rank",
      ascending: true,
    });
  });

  it("ignores an unknown sort field rather than passing it to the database", () => {
    expect(parseSort("id; drop table contacts", "asc").column).toBe("created_at");
  });
});

describe("parsePriorityFilter", () => {
  it("accepts each valid priority", () => {
    expect(parsePriorityFilter("high")).toBe("high");
    expect(parsePriorityFilter("low")).toBe("low");
  });

  it("returns null for anything else", () => {
    expect(parsePriorityFilter("all")).toBeNull();
    expect(parsePriorityFilter(null)).toBeNull();
  });
});
