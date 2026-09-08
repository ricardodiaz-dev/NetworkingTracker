import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Proves the route handler is a real trust boundary: invalid input is rejected with a 400
 * and the Data API is never called, and a request without a bearer token is rejected with
 * a 401 before any database work happens.
 */

const insert = vi.fn();
const from = vi.fn();
const createClient = vi.fn(() => ({ from }));

vi.mock("@neondatabase/neon-js", () => ({
  createClient: (...args: unknown[]) => createClient(...(args as [])),
}));

process.env.NEON_DATA_API_URL = "https://example.test/rest/v1";

const { POST, GET } = await import("@/app/api/contacts/route");

function post(body: unknown, token: string | null = "test-token") {
  return new Request("http://localhost/api/contacts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();

  const chain = {
    select: vi.fn(() => chain),
    single: vi.fn(async () => ({ data: { id: "1" }, error: null })),
    eq: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(async () => ({ data: [], error: null })),
  };
  insert.mockReturnValue(chain);
  from.mockReturnValue({ ...chain, insert });
});

describe("POST /api/contacts", () => {
  it("rejects a missing bearer token with 401 and never touches the database", async () => {
    const response = await POST(post({ name: "Ada", priority: "high" }, null));

    expect(response.status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects an empty name with 400 and never touches the database", async () => {
    const response = await POST(post({ name: "", priority: "high" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fields.name).toBe("Name is required.");
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an invalid priority with 400 and never touches the database", async () => {
    const response = await POST(post({ name: "Ada", priority: "urgent" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fields.priority).toBe("Priority must be one of: high, medium, low.");
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON with 400", async () => {
    const response = await POST(post("{not json", "test-token"));

    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("never forwards a client-supplied user_id to the database", async () => {
    const response = await POST(
      post({ name: "Ada", priority: "high", user_id: "someone-else" }),
    );

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).not.toHaveProperty("user_id");
  });
});

describe("GET /api/contacts", () => {
  it("rejects a missing bearer token with 401", async () => {
    const response = await GET(new Request("http://localhost/api/contacts"));

    expect(response.status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("never scopes the query by user_id in application code — RLS does that", async () => {
    const request = new Request("http://localhost/api/contacts", {
      headers: { Authorization: "Bearer test-token" },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);

    const chain = from.mock.results[0].value;
    const eqColumns = chain.eq.mock.calls.map((call: unknown[]) => call[0]);
    expect(eqColumns).not.toContain("user_id");
  });
});
