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
    const noteId = String(body?.noteId ?? "");
    const nonceBase64 = String(body?.nonceBase64 ?? "");
    const ciphertextBase64 = String(body?.ciphertextBase64 ?? "");

    if (!noteId || !nonceBase64 || !ciphertextBase64) {
      return json(res, 400, { error: "Missing noteId/nonceBase64/ciphertextBase64" });
    }

    // 1) Ensure per-user bucket exists.
    const createBucketRes = await supabaseAdmin.storage.createBucket(bucket, { public: false });
    if (createBucketRes.error) {
      const msg = createBucketRes.error.message.toLowerCase();
      const alreadyExists = msg.includes("already exists") || msg.includes("duplicate") || msg.includes("exists");
      if (!alreadyExists) {
        return json(res, 500, { error: `Failed to create bucket: ${createBucketRes.error.message}` });
      }
    }

    // 2) Upload encrypted markdown file.
    const objectPath = `notes/${noteId}.md`;
    const markdown =
      `<!-- encrypted-note:v1\n` +
      `nonce:${nonceBase64}\n` +
      `ciphertext:${ciphertextBase64}\n` +
      `-->\n`;

    const uploadRes = await supabaseAdmin.storage
      .from(bucket)
      .upload(objectPath, Buffer.from(markdown, "utf8"), {
        upsert: true,
        contentType: "text/markdown; charset=utf-8",
      });

    if (uploadRes.error) {
      return json(res, 500, { error: `Storage upload failed: ${uploadRes.error.message}` });
    }

    // 3) Persist bucket/object pointers back to the row.
    const updateRes = await supabaseAdmin
      .from("notes")
      .update({ bucket_id: bucket, object_path: objectPath })
      .eq("id", noteId)
      .eq("user_id", userId);

    if (updateRes.error) {
      return json(res, 500, { error: `Failed to update note pointers: ${updateRes.error.message}` });
    }

    return json(res, 200, { bucket_id: bucket, object_path: objectPath });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(res, 500, { error: msg });
  }
}
