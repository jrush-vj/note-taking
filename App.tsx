import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { supabase } from "./lib/supabaseClient";
import {
  decryptMasterKey,
  deriveKeyFromPassphrase,
  encryptMasterKey,
  generateMasterKeyBase64,
  generateSaltBase64,
  importAesKeyFromBase64,
} from "./lib/crypto";
import { useZkNotes } from "./hooks/useZkNotes";
import type { Note, Notebook as NotebookType } from "./types/note";
import { MobilePhoneUI } from "./components/MobilePhoneUI";

export default function App() {
  const [session, setSession] = useState<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"] | null>(null);
  const userId = session?.user?.id ?? null;
  const userEmail = session?.user?.email ?? null;
  const lastUserIdRef = useRef<string | null>(null);

  const [saltBase64, setSaltBase64] = useState<string | null>(null);
  const [encryptedMasterKey, setEncryptedMasterKey] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState<string>("");
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [passphraseError, setPassphraseError] = useState<string | null>(null);

  const encryptionReady = useMemo(() => Boolean(userId && encryptionKey), [encryptionKey, userId]);

  const accessToken = session?.access_token ?? null;
  const { notes, notebooks, addNote, addNotebook, updateNote, deleteNote, reload } = useZkNotes(userId, encryptionKey, accessToken);

  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);

  // Auth setup
  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) setAuthError(error.message);
      setSession(data.session);
      lastUserIdRef.current = data.session?.user?.id ?? null;
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);

      const nextUserId = nextSession?.user?.id ?? null;
      const lastUserId = lastUserIdRef.current;

      const userChanged = Boolean(lastUserId && nextUserId && lastUserId !== nextUserId);
      const signedOut = event === "SIGNED_OUT" || !nextUserId;

      if (signedOut || userChanged) {
        setSaltBase64(null);
        setEncryptedMasterKey(null);
        setEncryptionKey(null);
        setPassphrase("");
        setAuthError(null);
        setPassphraseError(null);
      }

      lastUserIdRef.current = nextUserId;
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;

    void (async () => {
      const { data, error } = await supabase
        .from("user_keys")
        .select("salt,encrypted_master_key")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        setAuthError(error.message);
        return;
      }

      if (data?.salt && data?.encrypted_master_key) {
        setSaltBase64(data.salt);
        setEncryptedMasterKey(data.encrypted_master_key);
        return;
      }

      setSaltBase64(null);
      setEncryptedMasterKey(null);
    })();
  }, [userEmail, userId]);

  const signInWithGoogle = async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) setAuthError(error.message);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const unlockEncryption = async () => {
    if (passphrase.trim().length < 8) {
      setPassphraseError("Passphrase must be at least 8 characters.");
      return;
    }
    setPassphraseError(null);

    try {
      if (saltBase64 && encryptedMasterKey) {
        const passphraseKey = await deriveKeyFromPassphrase(passphrase, saltBase64);
        const masterKeyBase64 = await decryptMasterKey(passphraseKey, encryptedMasterKey);
        const masterKey = await importAesKeyFromBase64(masterKeyBase64);
        setEncryptionKey(masterKey);
        return;
      }

      if (!userId) throw new Error("Not authenticated");
      const newSalt = generateSaltBase64();
      const passphraseKey = await deriveKeyFromPassphrase(passphrase, newSalt);
      const masterKeyBase64 = generateMasterKeyBase64();
      const encrypted = await encryptMasterKey(passphraseKey, masterKeyBase64);

      const upsertRes = await supabase.from("user_keys").upsert(
        {
          user_id: userId,
          encrypted_master_key: encrypted,
          salt: newSalt,
          kdf: "pbkdf2-sha256",
          kdf_params: { iterations: 210000 },
          key_version: 1,
        },
        { onConflict: "user_id" }
      );

      if (upsertRes.error) throw upsertRes.error;

      setSaltBase64(newSalt);
      setEncryptedMasterKey(encrypted);

      const masterKey = await importAesKeyFromBase64(masterKeyBase64);
      setEncryptionKey(masterKey);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to unlock";
      setPassphraseError(msg);
    }
  };

  const createNotebook = useCallback(
    async (name: string) => {
      return addNotebook(name);
    },
    [addNotebook]
  );

  const createNote = useCallback(
    async (notebookId?: string) => {
      return addNote(notebookId);
    },
    [addNote]
  );

  const saveNote = useCallback(
    async (note: Note) => {
      await updateNote(note.id, note);
    },
    [updateNote]
  );

  const removeNote = useCallback(
    async (noteId: string) => {
      await deleteNote(noteId);
    },
    [deleteNote]
  );

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark-amoled:bg-black">
        <Card className="w-full max-w-md glass">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {authError && <p className="text-sm text-red-600">{authError}</p>}
            <Button onClick={signInWithGoogle} className="w-full">
              Continue with Google
            </Button>
            <p className="text-xs text-gray-500 dark-amoled:text-gray-400">
              You will be asked for a passphrase next. It encrypts your notes before they are stored in Supabase.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!encryptionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark-amoled:bg-black">
        <Card className="w-full max-w-md glass">
          <CardHeader>
            <CardTitle>Unlock Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600 dark-amoled:text-gray-300">Signed in as {userEmail}</p>
            {authError && <p className="text-sm text-red-600">{authError}</p>}
            {passphraseError && <p className="text-sm text-red-600">{passphraseError}</p>}
            <Input
              type="password"
              placeholder={encryptedMasterKey ? "Enter your passphrase" : "Create a passphrase (you must remember it)"}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && unlockEncryption()}
            />
            <div className="flex gap-2">
              <Button onClick={unlockEncryption} className="flex-1">
                Unlock
              </Button>
              <Button variant="outline" onClick={signOut}>
                Sign out
              </Button>
            </div>
            <p className="text-xs text-gray-500 dark-amoled:text-gray-400">
              This passphrase is never sent to Supabase. If you forget it, existing notes cannot be decrypted.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <MobilePhoneUI
      notes={notes}
      notebooks={notebooks}
      selectedNotebookId={selectedNotebookId}
      onSelectNotebook={(id) => setSelectedNotebookId(id)}
      onCreateNotebook={createNotebook}
      onCreateNote={createNote}
      onUpdateNote={saveNote}
      onDeleteNote={removeNote}
      onReload={reload}
      onSignOut={signOut}
    />
  );
}
