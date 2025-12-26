/**
 * Web-specific hook for Supabase authentication with Google OAuth
 * Manages user session, encryption keys, and authentication flow
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  decryptMasterKey,
  deriveKeyFromPassphrase,
  encryptMasterKey,
  generateMasterKeyBase64,
  generateSaltBase64,
  importAesKeyFromBase64,
} from "../lib/crypto";
import type { Session, User } from "@supabase/supabase-js";

export interface AuthState {
  session: Session | null;
  user: User | null;
  userId: string | null;
  userEmail: string | null;
  accessToken: string | null;
  
  // Encryption state
  encryptionKey: CryptoKey | null;
  needsEncryptionSetup: boolean;
  needsUnlock: boolean;
  saltBase64: string | null;
  encryptedMasterKey: string | null;
  
  // UI state
  isLoading: boolean;
  authError: string | null;
  
  // Actions
  signInWithGoogle: () => Promise<void>;
  setupEncryption: (passphrase: string) => Promise<void>;
  unlockWithPassphrase: (passphrase: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export function useWebAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [saltBase64, setSaltBase64] = useState<string | null>(null);
  const [encryptedMasterKey, setEncryptedMasterKey] = useState<string | null>(null);
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const userId = session?.user?.id ?? null;
  const userEmail = session?.user?.email ?? null;
  const accessToken = session?.access_token ?? null;

  // Determine auth state:
  // - needsEncryptionSetup: user signed in but has no encryption keys in DB (first time)
  // - needsUnlock: user has keys but hasn't unlocked with passphrase yet
  const needsEncryptionSetup = Boolean(userId && !saltBase64 && !encryptedMasterKey);
  const needsUnlock = Boolean(userId && saltBase64 && encryptedMasterKey && !encryptionKey);

  // Initialize session
  useEffect(() => {
    void (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          setAuthError(error.message);
          return;
        }
        setSession(data.session);
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : "Failed to get session");
      }
    })();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      
      // Clear encryption on sign out
      if (!newSession) {
        setSaltBase64(null);
        setEncryptedMasterKey(null);
        setEncryptionKey(null);
        setAuthError(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch encryption keys when user signs in
  useEffect(() => {
    if (!userId) return;

    void (async () => {
      try {
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
        } else {
          // User needs to set up encryption
          setSaltBase64(null);
          setEncryptedMasterKey(null);
        }
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : "Failed to fetch encryption keys");
      }
    })();
  }, [userId]);

  // Sign in with Google
  const signInWithGoogle = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        setAuthError(error.message);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Failed to sign in with Google");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Set up encryption for new user
  const setupEncryption = useCallback(
    async (passphrase: string) => {
      if (!userId) {
        setAuthError("No user signed in");
        return;
      }

      setIsLoading(true);
      setAuthError(null);

      try {
        // Generate new encryption keys
        const newSaltBase64 = generateSaltBase64();
        const passphraseKey = await deriveKeyFromPassphrase(passphrase, newSaltBase64);
        const masterKeyBase64 = generateMasterKeyBase64();
        const newEncryptedMasterKey = await encryptMasterKey(passphraseKey, masterKeyBase64);

        // Store in database
        const { error } = await supabase.from("user_keys").insert({
          user_id: userId,
          salt: newSaltBase64,
          encrypted_master_key: newEncryptedMasterKey,
        });

        if (error) {
          setAuthError(error.message);
          return;
        }

        // Import and set the master key
        const masterKey = await importAesKeyFromBase64(masterKeyBase64);

        setSaltBase64(newSaltBase64);
        setEncryptedMasterKey(newEncryptedMasterKey);
        setEncryptionKey(masterKey);
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : "Failed to set up encryption");
      } finally {
        setIsLoading(false);
      }
    },
    [userId]
  );

  // Unlock with passphrase (for returning users)
  const unlockWithPassphrase = useCallback(
    async (passphrase: string) => {
      if (!saltBase64 || !encryptedMasterKey) {
        setAuthError("Encryption keys not found");
        return;
      }

      setIsLoading(true);
      setAuthError(null);

      try {
        const passphraseKey = await deriveKeyFromPassphrase(passphrase, saltBase64);
        const masterKeyBase64 = await decryptMasterKey(passphraseKey, encryptedMasterKey);
        const masterKey = await importAesKeyFromBase64(masterKeyBase64);
        setEncryptionKey(masterKey);
      } catch (err) {
        setAuthError("Incorrect passphrase. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [saltBase64, encryptedMasterKey]
  );

  // Sign out
  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
      setSession(null);
      setSaltBase64(null);
      setEncryptedMasterKey(null);
      setEncryptionKey(null);
      setAuthError(null);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Failed to sign out");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    session,
    user: session?.user ?? null,
    userId,
    userEmail,
    accessToken,
    encryptionKey,
    needsEncryptionSetup,
    needsUnlock,
    saltBase64,
    encryptedMasterKey,
    isLoading,
    authError,
    signInWithGoogle,
    setupEncryption,
    unlockWithPassphrase,
    signOut,
  };
}
