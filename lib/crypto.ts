function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function generateMasterKeyBase64(): string {
  // 32 bytes -> AES-256
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64(keyBytes);
}

export async function importAesKeyFromBase64(masterKeyBase64: string): Promise<CryptoKey> {
  const keyBytes = base64ToBytes(masterKeyBase64);
  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(keyBytes),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

type EncryptedMasterKeyV1 = {
  v: 1;
  nonce: string;
  ciphertext: string;
};

export async function encryptMasterKey(passphraseKey: CryptoKey, masterKeyBase64: string): Promise<string> {
  const { nonceBase64, ciphertextBase64 } = await encryptString(passphraseKey, masterKeyBase64);
  const payload: EncryptedMasterKeyV1 = { v: 1, nonce: nonceBase64, ciphertext: ciphertextBase64 };
  return JSON.stringify(payload);
}

export async function decryptMasterKey(passphraseKey: CryptoKey, encryptedMasterKey: string): Promise<string> {
  const payload = JSON.parse(encryptedMasterKey) as Partial<EncryptedMasterKeyV1>;
  if (payload?.v !== 1 || !payload.nonce || !payload.ciphertext) {
    throw new Error("Invalid encrypted_master_key format");
  }
  return decryptString(passphraseKey, payload.nonce, payload.ciphertext);
}

export async function deriveKeyFromPassphrase(passphrase: string, saltBase64: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const salt = base64ToBytes(saltBase64);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: 210_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export function generateSaltBase64(): string {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return bytesToBase64(salt);
}

export async function encryptString(key: CryptoKey, plaintext: string): Promise<{ nonceBase64: string; ciphertextBase64: string }> {
  const enc = new TextEncoder();
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(nonce) }, key, enc.encode(plaintext));

  return {
    nonceBase64: bytesToBase64(nonce),
    ciphertextBase64: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptString(key: CryptoKey, nonceBase64: string, ciphertextBase64: string): Promise<string> {
  const nonce = base64ToBytes(nonceBase64);
  const ciphertext = base64ToBytes(ciphertextBase64);

  const plaintextBytes = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(nonce) },
    key,
    toArrayBuffer(ciphertext)
  );
  return new TextDecoder().decode(plaintextBytes);
}
