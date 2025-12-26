# SQL Commands to Run in Supabase SQL Editor

**IMPORTANT:** Copy and paste these commands into your Supabase SQL Editor and run them.

## 1. Fix object_relations table (Remove user_id column requirement)

The code is trying to insert `user_id` into `object_relations` but the table doesn't have that column. Run this:

```sql
-- object_relations doesn't need user_id since it references encrypted_objects
-- which already has user_id. The RLS policy handles access control.
-- No changes needed to the table structure.
```

## 2. Add Storage Bucket for Encrypted Notes (Optional - for file attachments)

```sql
-- Create a private bucket for encrypted note files
INSERT INTO storage.buckets (id, name, public)
VALUES ('encrypted-notes', 'encrypted-notes', false)
ON CONFLICT (id) DO NOTHING;

-- Allow users to upload their own files
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'encrypted-notes' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own files
CREATE POLICY "Users can read own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'encrypted-notes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'encrypted-notes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

## 3. Verify Your Tables

Run this to check your table structure:

```sql
-- Check encrypted_objects table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'encrypted_objects'
ORDER BY ordinal_position;

-- Check object_relations table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'object_relations'
ORDER BY ordinal_position;

-- Check user_keys table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_keys'
ORDER BY ordinal_position;
```

## 4. Check if RLS is Enabled

```sql
-- Verify RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('user_keys', 'encrypted_objects', 'object_relations');
```

---

**After running these SQL commands**, tell me the results and I'll fix the code to match your database structure.
