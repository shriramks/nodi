-- Provider credentials are user-owned. Store app-encrypted ciphertext, not plaintext.
-- Encryption/decryption happens in the Next.js server with PROVIDER_SECRETS_KEY.

alter table public.provider_connection_secrets
  add column if not exists client_id_encrypted text null,
  add column if not exists client_secret_encrypted text null,
  add column if not exists api_token_encrypted text null,
  add column if not exists access_token_encrypted text null,
  add column if not exists refresh_token_encrypted text null;
