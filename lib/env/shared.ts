function readRequiredString(name: string, label: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${label}. Set ${name} in your environment.`);
  }

  return value;
}

function requireValue(value: string | undefined, name: string, label: string) {
  if (!value) {
    throw new Error(`Missing ${label}. Set ${name} in your environment.`);
  }

  return value;
}

function readRequiredUrl(value: string | undefined, name: string, label: string) {
  const url = requireValue(value, name, label);

  try {
    return new URL(url).toString();
  } catch {
    throw new Error(`Invalid ${label}. Expected ${name} to be a valid URL.`);
  }
}

export const sharedEnv = {
  supabaseUrl: readRequiredUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    "NEXT_PUBLIC_SUPABASE_URL",
    "Supabase URL",
  ),
} as const;

export { readRequiredString, requireValue };
