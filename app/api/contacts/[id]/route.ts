import {
  dataApiForToken,
  databaseError,
  getBearerToken,
  unauthorized,
  validationFailed,
} from "@/lib/neon/server";
import { parseUpdateContact } from "@/lib/validation";

export const dynamic = "force-dynamic";

const COLUMNS = "id,user_id,name,company,role,met_at,notes,priority,created_at,updated_at";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const notFound = () =>
  Response.json({ error: "That contact does not exist." }, { status: 404 });

/**
 * Edit a contact. The query filters on id alone — RLS supplies the ownership predicate,
 * so a request for someone else's id matches zero rows and returns 404 rather than
 * leaking that the row exists.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = getBearerToken(request);
  if (!token) return unauthorized();

  const { id } = await params;
  if (!UUID.test(id)) return notFound();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = parseUpdateContact(body);
  if (!parsed.ok) return validationFailed(parsed.errors);

  const { data, error } = await dataApiForToken(token)
    .from("contacts")
    .update(parsed.data)
    .eq("id", id)
    .select(COLUMNS);

  if (error) return databaseError(error);
  if (!data || data.length === 0) return notFound();

  return Response.json({ contact: data[0] });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = getBearerToken(request);
  if (!token) return unauthorized();

  const { id } = await params;
  if (!UUID.test(id)) return notFound();

  const { data, error } = await dataApiForToken(token)
    .from("contacts")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) return databaseError(error);
  if (!data || data.length === 0) return notFound();

  return new Response(null, { status: 204 });
}
