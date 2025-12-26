/**
 * Main App Entry - Handles Web (Supabase) and Desktop (Local) modes
 */

import { AuthScreen } from "./components/AuthScreen";
import { useWebAuth } from "./hooks/useWebAuth";
import { AppDesktop } from "./AppDesktop";
import { AppWeb } from "./AppWeb";

// Check if running in web or desktop mode
const appMode = import.meta.env.VITE_APP_MODE || "web";
const isWebMode = appMode === "web";

export default function App() {
  if (!isWebMode) {
    // Desktop mode: No authentication, use local storage
    return <AppDesktop />;
  }

  // Web mode: Use Supabase authentication
  return <WebAppWrapper />;
}

function WebAppWrapper() {
  const auth = useWebAuth();

  // Show auth screen if not signed in
  if (!auth.session) {
    return (
      <AuthScreen
        onGoogleSignIn={auth.signInWithGoogle}
        onSetupEncryption={auth.setupEncryption}
        onUnlockWithPassphrase={auth.unlockWithPassphrase}
        needsEncryptionSetup={false}
        needsUnlock={false}
        authError={auth.authError}
        isLoading={auth.isLoading}
      />
    );
  }

  // Show encryption setup screen for first-time users
  if (auth.needsEncryptionSetup) {
    return (
      <AuthScreen
        onGoogleSignIn={auth.signInWithGoogle}
        onSetupEncryption={auth.setupEncryption}
        onUnlockWithPassphrase={auth.unlockWithPassphrase}
        needsEncryptionSetup={true}
        needsUnlock={false}
        authError={auth.authError}
        isLoading={auth.isLoading}
      />
    );
  }

  // Show unlock screen for returning users
  if (auth.needsUnlock) {
    return (
      <AuthScreen
        onGoogleSignIn={auth.signInWithGoogle}
        onSetupEncryption={auth.setupEncryption}
        onUnlockWithPassphrase={auth.unlockWithPassphrase}
        needsEncryptionSetup={false}
        needsUnlock={true}
        authError={auth.authError}
        isLoading={auth.isLoading}
        userEmail={auth.userEmail}
      />
    );
  }

  // Show main app once authenticated and encryption is ready
  if (auth.encryptionKey && auth.userId) {
    return (
      <AppWeb
        userId={auth.userId}
        userEmail={auth.userEmail}
        encryptionKey={auth.encryptionKey}
        accessToken={auth.accessToken}
        onSignOut={auth.signOut}
      />
    );
  }

  // Loading state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark-amoled:from-gray-950 dark-amoled:via-black dark-amoled:to-blue-950">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 dark-amoled:text-gray-400">Loading...</p>
      </div>
    </div>
  );
}
