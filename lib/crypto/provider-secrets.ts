import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

import { AppError } from "@/lib/errors";

type EncryptedProviderSecret = {
  alg: "A256GCM";
  ciphertext: string;
  iv: string;
  tag: string;
  v: 1;
};

const keyLength = 32;
const ivLength = 12;

export function encryptProviderSecret(value: string) {
  const key = providerSecretsKey();
  const iv = randomBytes(ivLength);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const payload: EncryptedProviderSecret = {
    alg: "A256GCM",
    ciphertext: toBase64Url(ciphertext),
    iv: toBase64Url(iv),
    tag: toBase64Url(cipher.getAuthTag()),
    v: 1,
  };

  return JSON.stringify(payload);
}

export function decryptProviderSecret(value: string) {
  const key = providerSecretsKey();
  const payload = parseEncryptedProviderSecret(value);
  const decipher = createDecipheriv("aes-256-gcm", key, fromBase64Url(payload.iv));

  decipher.setAuthTag(fromBase64Url(payload.tag));

  return Buffer.concat([
    decipher.update(fromBase64Url(payload.ciphertext)),
    decipher.final(),
  ]).toString("utf8");
}

function providerSecretsKey() {
  const value = process.env.PROVIDER_SECRETS_KEY?.trim();

  if (!value) {
    throw new AppError("PROVIDER_SECRETS_KEY is required to store provider credentials.", {
      code: "PROVIDER_SECRETS_KEY_MISSING",
      status: 500,
    });
  }

  const key = fromBase64Url(value);

  if (key.length !== keyLength) {
    throw new AppError("PROVIDER_SECRETS_KEY must be a 32-byte base64 value.", {
      code: "PROVIDER_SECRETS_KEY_INVALID",
      status: 500,
    });
  }

  return key;
}

function parseEncryptedProviderSecret(value: string): EncryptedProviderSecret {
  let payload: unknown;

  try {
    payload = JSON.parse(value);
  } catch (error) {
    throw new AppError("Provider secret ciphertext is invalid.", {
      cause: error,
      code: "PROVIDER_SECRET_INVALID",
      status: 500,
    });
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    (payload as Partial<EncryptedProviderSecret>).v !== 1 ||
    (payload as Partial<EncryptedProviderSecret>).alg !== "A256GCM" ||
    typeof (payload as Partial<EncryptedProviderSecret>).ciphertext !== "string" ||
    typeof (payload as Partial<EncryptedProviderSecret>).iv !== "string" ||
    typeof (payload as Partial<EncryptedProviderSecret>).tag !== "string"
  ) {
    throw new AppError("Provider secret ciphertext is invalid.", {
      code: "PROVIDER_SECRET_INVALID",
      status: 500,
    });
  }

  return payload as EncryptedProviderSecret;
}

function toBase64Url(value: Buffer) {
  return value.toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}
