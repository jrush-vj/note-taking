# 🚀 Quick Start - Google OAuth Setup

## Step 1: Set Up Supabase (5 minutes)

### A. Create Supabase Project
1. Go to https://app.supabase.com
2. Click **"New Project"**
3. Name it (e.g., "notemaster")
4. Choose a database password
5. Select a region close to you
6. Click **"Create new project"** (takes ~2 minutes)

### B. Get Your Credentials
1. Go to **Project Settings** (gear icon) → **API**
2. Copy these values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

## Step 2: Enable Google OAuth (3 minutes)

### A. Configure in Supabase
1. In Supabase, go to **Authentication** → **Providers**
2. Find **Google** and click to expand
3. Toggle **"Enable Sign in with Google"**
4. Copy the **Callback URL** shown (e.g., `https://xxxxx.supabase.co/auth/v1/callback`)

### B. Set Up Google OAuth Credentials
1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Go to **APIs & Services** → **Credentials**
4. Click **"Create Credentials"** → **"OAuth 2.0 Client IDs"**
5. Configure consent screen if prompted (just fill required fields)
6. For Application type, select **"Web application"**
7. Add **Authorized redirect URIs**: Paste the Supabase callback URL from step A
8. Click **"Create"**
9. Copy the **Client ID** and **Client Secret**

### C. Complete Supabase Setup
1. Back in Supabase Google provider settings, paste:
   - Client ID
   - Client Secret
2. Click **"Save"**

## Step 3: Set Up Database (2 minutes)

1. In Supabase, go to **SQL Editor**
2. Click **"New query"**
3. Copy and paste this SQL:

```sql
-- Create user_keys table for encryption
CREATE TABLE user_keys (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  salt TEXT NOT NULL,
  encrypted_master_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own keys" ON user_keys
  FOR ALL USING (auth.uid() = user_id);

-- Create encrypted_objects table
CREATE TABLE encrypted_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('note', 'notebook', 'tag')),
  ciphertext TEXT NOT NULL,
  nonce TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE encrypted_objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own objects" ON encrypted_objects
  FOR ALL USING (auth.uid() = user_id);

-- Create object_relations table
CREATE TABLE object_relations (
  parent_id UUID NOT NULL REFERENCES encrypted_objects(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES encrypted_objects(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('contains', 'tagged')),
  PRIMARY KEY (parent_id, child_id, relation_type)
);

ALTER TABLE object_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own relations" ON object_relations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM encrypted_objects
      WHERE id = parent_id AND user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX idx_encrypted_objects_user_type ON encrypted_objects(user_id, type);
CREATE INDEX idx_encrypted_objects_updated ON encrypted_objects(user_id, updated_at DESC);
CREATE INDEX idx_relations_parent ON object_relations(parent_id);
CREATE INDEX idx_relations_child ON object_relations(child_id);
```

4. Click **"Run"** (or press Ctrl+Enter)
5. Should see "Success. No rows returned"

## Step 4: Configure Your App

Create a `.env` file in your project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_APP_MODE=web
```

Replace with your actual values from Step 1B.

## Step 5: Run Locally

```bash
npm install
npm run dev
```

Visit http://localhost:5173 and click **"Continue with Google"**!

## Step 6: Deploy to Vercel (Optional)

1. Push code to GitHub
2. Go to https://vercel.com/new
3. Import your repository
4. Add environment variables in Vercel settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_APP_MODE=web`
5. Deploy!

---

## 🔒 Security Note

Your encryption passphrase is NEVER sent to servers. All encryption happens in your browser. 
If you lose your passphrase, your notes cannot be recovered.

## 🐛 Troubleshooting

**"Invalid credentials" error:**
- Check that your `.env` file has the correct Supabase URL and key
- Make sure you're using the **anon public** key, not the service_role key

**Google sign-in doesn't work:**
- Verify the redirect URI in Google Console matches exactly
- Check that Google provider is enabled in Supabase

**Can't see notes after sign-in:**
- You need to create a passphrase after first Google sign-in
- This passphrase encrypts all your notes

**Need help?**
Open an issue on GitHub or check the full [SETUP.md](SETUP.md) guide.
