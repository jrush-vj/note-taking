/**
 * Authentication Screen with Google OAuth
 * Beautiful, modern design for signing in to the note-taking app
 */

import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Shield, Sparkles, Lock, FileText, Search, Zap } from "lucide-react";

interface AuthScreenProps {
  onGoogleSignIn: () => Promise<void>;
  onSetupEncryption: (passphrase: string) => Promise<void>;
  onUnlockWithPassphrase: (passphrase: string) => Promise<void>;
  needsEncryptionSetup: boolean;
  needsUnlock: boolean;
  authError: string | null;
  isLoading: boolean;
  userEmail?: string | null;
}

export function AuthScreen({
  onGoogleSignIn,
  onSetupEncryption,
  onUnlockWithPassphrase,
  needsEncryptionSetup,
  needsUnlock,
  authError,
  isLoading,
  userEmail,
}: AuthScreenProps) {
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSetupEncryption = async () => {
    if (passphrase.length < 8) {
      setError("Passphrase must be at least 8 characters");
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError("Passphrases do not match");
      return;
    }
    setError(null);
    await onSetupEncryption(passphrase);
  };

  const handleUnlock = async () => {
    if (!passphrase) {
      setError("Please enter your passphrase");
      return;
    }
    setError(null);
    await onUnlockWithPassphrase(passphrase);
  };

  // Unlock screen for returning users
  if (needsUnlock) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark-amoled:from-gray-950 dark-amoled:via-black dark-amoled:to-blue-950 p-4">
        <div className="w-full max-w-md">
          <div className="glass-strong rounded-2xl p-8 shadow-2xl">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <Lock className="h-8 w-8 text-white" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-center mb-2">Welcome Back!</h1>
            <p className="text-sm text-gray-600 dark-amoled:text-gray-400 text-center mb-6">
              {userEmail && <span className="font-medium">{userEmail}</span>}
              {userEmail && <br />}
              Enter your passphrase to unlock your encrypted notes
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Passphrase</label>
                <Input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                  placeholder="Enter your passphrase"
                  className="w-full"
                  autoFocus
                />
              </div>

              {(error || authError) && (
                <div className="p-3 bg-red-50 dark-amoled:bg-red-900/20 border border-red-200 dark-amoled:border-red-800 rounded-lg text-red-700 dark-amoled:text-red-300 text-sm">
                  {error || authError}
                </div>
              )}

              <Button onClick={handleUnlock} disabled={isLoading} className="w-full">
                {isLoading ? "Unlocking..." : "Unlock"}
              </Button>

              <div className="p-4 bg-blue-50 dark-amoled:bg-blue-900/20 rounded-lg border border-blue-200 dark-amoled:border-blue-800">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-600 dark-amoled:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-800 dark-amoled:text-blue-300">
                    <strong>Secure:</strong> Your passphrase is never sent to our servers. 
                    All decryption happens locally in your browser.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Setup encryption screen for first-time users
  if (needsEncryptionSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark-amoled:from-gray-950 dark-amoled:via-black dark-amoled:to-blue-950 p-4">
        <div className="w-full max-w-md">
          <div className="glass-strong rounded-2xl p-8 shadow-2xl">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <Lock className="h-8 w-8 text-white" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-center mb-2">Secure Your Notes</h1>
            <p className="text-sm text-gray-600 dark-amoled:text-gray-400 text-center mb-6">
              Create a passphrase to encrypt your notes end-to-end. Only you will have access.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Passphrase</label>
                <Input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Enter secure passphrase (min 8 characters)"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Confirm Passphrase</label>
                <Input
                  type="password"
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                  placeholder="Re-enter passphrase"
                  className="w-full"
                />
              </div>

              {(error || authError) && (
                <div className="p-3 bg-red-50 dark-amoled:bg-red-900/20 border border-red-200 dark-amoled:border-red-800 rounded-lg text-red-700 dark-amoled:text-red-300 text-sm">
                  {error || authError}
                </div>
              )}

              <Button onClick={handleSetupEncryption} disabled={isLoading} className="w-full">
                {isLoading ? "Setting up..." : "Secure My Notes"}
              </Button>

              <div className="p-4 bg-blue-50 dark-amoled:bg-blue-900/20 rounded-lg border border-blue-200 dark-amoled:border-blue-800">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-600 dark-amoled:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-800 dark-amoled:text-blue-300">
                    <strong>Zero-Knowledge Encryption:</strong> Your passphrase never leaves your device. 
                    All notes are encrypted before being stored. If you forget your passphrase, your notes cannot be recovered.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark-amoled:from-gray-950 dark-amoled:via-black dark-amoled:to-blue-950 p-4">
      <div className="w-full max-w-5xl">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Left: Branding & Features */}
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    NoteMaster
                  </h1>
                  <p className="text-sm text-gray-600 dark-amoled:text-gray-400">
                    Your thoughts, beautifully organized
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <FeatureItem
                icon={<Lock className="h-5 w-5" />}
                title="End-to-End Encrypted"
                description="Zero-knowledge encryption keeps your notes private"
              />
              <FeatureItem
                icon={<Search className="h-5 w-5" />}
                title="Powerful Search"
                description="Find anything instantly with fuzzy search"
              />
              <FeatureItem
                icon={<Zap className="h-5 w-5" />}
                title="Lightning Fast"
                description="Optimized for speed and performance"
              />
              <FeatureItem
                icon={<Sparkles className="h-5 w-5" />}
                title="Rich Features"
                description="Templates, tags, notebooks, and more"
              />
            </div>
          </div>

          {/* Right: Sign In Card */}
          <div className="glass-strong rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Welcome Back</h2>
              <p className="text-sm text-gray-600 dark-amoled:text-gray-400">
                Sign in to access your encrypted notes
              </p>
            </div>

            <div className="space-y-4">
              <Button
                onClick={onGoogleSignIn}
                disabled={isLoading}
                className="w-full h-12 text-base bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-300 shadow-sm"
              >
                <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {isLoading ? "Signing in..." : "Continue with Google"}
              </Button>

              {authError && (
                <div className="p-3 bg-red-50 dark-amoled:bg-red-900/20 border border-red-200 dark-amoled:border-red-800 rounded-lg text-red-700 dark-amoled:text-red-300 text-sm text-center">
                  {authError}
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark-amoled:border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark-amoled:bg-gray-900 px-2 text-gray-500">
                    Secure & Private
                  </span>
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark-amoled:bg-gray-900/50 rounded-lg border border-gray-200 dark-amoled:border-gray-800">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-600 dark-amoled:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-gray-700 dark-amoled:text-gray-300">
                    Your notes are encrypted with a passphrase only you know. 
                    We use industry-standard encryption to keep your data safe.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-600 dark-amoled:text-gray-400">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/50 dark-amoled:hover:bg-gray-900/50 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 dark-amoled:from-blue-900/30 dark-amoled:to-purple-900/30 flex items-center justify-center text-blue-600 dark-amoled:text-blue-400 flex-shrink-0">
        {icon}
      </div>
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-sm text-gray-600 dark-amoled:text-gray-400">{description}</div>
      </div>
    </div>
  );
}
