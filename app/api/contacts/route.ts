import {
  dataApiForToken,
  databaseError,
  getBearerToken,
  unauthorized,
  validationFailed,
} from "@/lib/neon/server";
import {
  parseCreateContact,
  parsePriorityFilter,
  parseSort,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

const COLUMNS = "id,user_id,name,company,role,met_at,notes,priority,created_at,updated_at";

/** List the signed-in user's contacts. Sorting and filtering are whitelisted, never raw. */
export async function GET(request: Request) {
  const token = getBearerToken(request);
  if (!token) return unauthorized();

  const url = new URL(request.url);
  const { column, ascending } = parseSort(
    url.searchParams.get("sort"),
    url.searchParams.get("direction"),
  );
  const priority = parsePriorityFilter(url.searchParams.get("priority"));
  const search = url.searchParams.get("search")?.trim();

  // No .eq("user_id", ...) here on purpose: scoping is RLS's job, not the API layer's.
  let query = dataApiForToken(token).from("contacts").select(COLUMNS);

  if (priority) {
    query = query.eq("priority", priority);
  }

  if (search) {
    // Escape PostgREST's pattern and list separators before interpolating.
    const escaped = search.replace(/[%,()\\]/g, "");
    if (escaped) {
      query = query.or(
        `name.ilike.%${escaped}%,company.ilike.%${escaped}%,role.ilike.%${escaped}%,met_at.ilike.%${escaped}%`,
      );
    }
  }

  const { data, error } = await query.order(column, { ascending });

  if (error) return databaseError(error);

  return Response.json({ contacts: data ?? [] });
}

/** Create a contact. user_id is never accepted from the client. */
export async function POST(request: Request) {
  const token = getBearerToken(request);
  if (!token) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = parseCreateContact(body);
  if (!parsed.ok) return validationFailed(parsed.errors);

  // Omitting user_id lets the column default to auth.user_id(), and the INSERT policy's
  // WITH CHECK confirms the result belongs to the caller.
  const { data, error } = await dataApiForToken(token)
    .from("contacts")
    .insert(parsed.data)
    .select(COLUMNS)
    .single();

  if (error) return databaseError(error);

  return Response.json({ contact: data }, { status: 201 });
}
