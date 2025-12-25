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

type StorageListItem = {
  name: string;
};

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
    const liveObjectIds = Array.isArray(body?.liveObjectIds) ? (body.liveObjectIds as unknown[]) : [];
    const live = new Set(liveObjectIds.map((x) => String(x)));

    // If bucket doesn't exist yet, there's nothing to clean.
    const limit = 1000;
    let offset = 0;
    const toDelete: string[] = [];

    while (true) {
      const listRes = await supabaseAdmin.storage.from(bucket).list("objects", {
        limit,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

      if (listRes.error) {
        const msg = listRes.error.message.toLowerCase();
        const noBucket = msg.includes("bucket") && msg.includes("not found");
        if (noBucket) return json(res, 200, { deleted: 0, reason: "bucket_missing" });
        return json(res, 500, { error: `Storage list failed: ${listRes.error.message}` });
      }

      const items = (listRes.data ?? []) as StorageListItem[];
      for (const item of items) {
        if (!item?.name) continue;
        if (!item.name.endsWith(".md")) continue;
        const objectId = item.name.slice(0, -3);
        if (!live.has(objectId)) {
          toDelete.push(`objects/${item.name}`);
        }
      }

      if (items.length < limit) break;
      offset += limit;
    }

    // Batch deletes to keep request sizes reasonable.
    let deleted = 0;
    const batchSize = 100;
    for (let i = 0; i < toDelete.length; i += batchSize) {
      const batch = toDelete.slice(i, i + batchSize);
      const removeRes = await supabaseAdmin.storage.from(bucket).remove(batch);
      if (removeRes.error) {
        return json(res, 500, { error: `Storage cleanup delete failed: ${removeRes.error.message}` });
      }
      deleted += batch.length;
    }

    return json(res, 200, { deleted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(res, 500, { error: msg });
  }
}
