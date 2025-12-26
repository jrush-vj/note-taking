# NoteMaster - Setup Guide

## 🌐 Web App (Browser) with Supabase

A beautiful, professional note-taking app with end-to-end encryption and Google OAuth sign-in.

### Prerequisites

1. **Supabase Account**: Create a free account at [supabase.com](https://supabase.com)
2. **Google OAuth Setup**: Configure Google OAuth in your Supabase project

### Quick Setup

#### 1. Create Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in project details and create

#### 2. Configure Google OAuth

1. In your Supabase project, go to **Authentication** → **Providers**
2. Enable **Google** provider
3. Follow Supabase's guide to set up Google OAuth:
   - Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/)
   - Add authorized redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`
   - Copy Client ID and Client Secret to Supabase

#### 3. Set Up Database

Run these SQL commands in Supabase SQL Editor:

```sql
-- Create user_keys table for encryption
CREATE TABLE user_keys (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  salt TEXT NOT NULL,
  encrypted_master_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own keys
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

-- Enable RLS
ALTER TABLE encrypted_objects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own objects
CREATE POLICY "Users can access own objects" ON encrypted_objects
  FOR ALL USING (auth.uid() = user_id);

-- Create object_relations table
CREATE TABLE object_relations (
  parent_id UUID NOT NULL REFERENCES encrypted_objects(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES encrypted_objects(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('contains', 'tagged')),
  PRIMARY KEY (parent_id, child_id, relation_type)
);

-- Enable RLS
ALTER TABLE object_relations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access relations for their own objects
CREATE POLICY "Users can access own relations" ON object_relations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM encrypted_objects
      WHERE id = parent_id AND user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX idx_encrypted_objects_user_type ON encrypted_objects(user_id, type);
CREATE INDEX idx_encrypted_objects_updated ON encrypted_objects(user_id, updated_at DESC);
CREATE INDEX idx_relations_parent ON object_relations(parent_id);
CREATE INDEX idx_relations_child ON object_relations(child_id);
```

#### 4. Enable Storage (Optional - for attachments)

1. Go to **Storage** in Supabase
2. Create a new bucket called `encrypted-notes`
3. Set it to **Private**
4. Add RLS policies to allow users to upload/download their own files

#### 5. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   VITE_APP_MODE=web
   ```

   Find these values in Supabase Project Settings → API

#### 6. Install and Run

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Deploy to Vercel

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel project settings
4. Deploy!

### Features

✨ **Core Features:**
- 🔐 End-to-end encryption (zero-knowledge)
- 🔑 Google OAuth sign-in
- 📝 Rich note editing
- 📁 Notebooks for organization
- 🏷️ Tags for categorization
- ⭐ Star and pin important notes
- 📦 Archive old notes
- 🔍 Powerful fuzzy search
- 📱 Responsive design

✨ **Advanced Features:**
- 🎨 Beautiful glass-morphism UI
- 🌙 Light/Dark theme
- ⌨️ Command palette (Cmd/Ctrl+K)
- 📋 Templates
- 📊 Graph view (2D/3D)
- 📥 Export/Import (JSON, Markdown, ZIP)
- 🔗 Wiki-style [[links]]
- ⚡ Real-time sync

### Security

- **Zero-Knowledge Encryption**: Your passphrase never leaves your browser
- **End-to-End Encrypted**: All notes encrypted before storage
- **Open Source**: Audit the code yourself
- **No Backdoors**: We can't access your notes even if we wanted to

### Support

For issues, please open a GitHub issue or contact support.

---

## 💻 Desktop App (Coming Soon)

Desktop app with local storage and optional Supabase sync for migration.
