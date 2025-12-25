import { createClient } from "@supabase/supabase-js";

type Req = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type Res = {
  status: (code: number) => Res;
  setHeader: (name: string, value: string) => void;
  send: (body: string) => void;
};

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function json(res: Res, status: number, body: unknown) {
  res.status(status);
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(body));
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const supabaseUrl = getEnv("SUPABASE_URL");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

    const authHeaderRaw = req.headers.authorization;
    const authHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
    if (!token) return json(res, 401, { error: "Missing Authorization Bearer token" });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const userRes = await supabaseAdmin.auth.getUser(token);
    if (userRes.error || !userRes.data.user) {
      return json(res, 401, { error: userRes.error?.message ?? "Invalid token" });
    }

    const userId = userRes.data.user.id;
    const bucket = `user-${userId}`;

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const objectId = String(body?.objectId ?? "");
    if (!objectId) return json(res, 400, { error: "Missing objectId" });

    const objectPath = `objects/${objectId}.md`;

    // Remove is idempotent: if object doesn't exist, we treat it as success.
    const removeRes = await supabaseAdmin.storage.from(bucket).remove([objectPath]);
    if (removeRes.error) {
      const msg = removeRes.error.message.toLowerCase();
      const ignore = msg.includes("not found") || msg.includes("does not exist");
      if (!ignore) {
        return json(res, 500, { error: `Storage delete failed: ${removeRes.error.message}` });
      }
    }

    return json(res, 200, { deleted: [objectPath] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(res, 500, { error: msg });
  }
}
