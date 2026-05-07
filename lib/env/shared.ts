function readRequiredString(name: string, label: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${label}. Set ${name} in your environment.`);
  }

  return value;
}

function readRequiredUrl(name: string, label: string) {
  const value = readRequiredString(name, label);

  try {
    return new URL(value).toString();
  } catch {
    throw new Error(`Invalid ${label}. Expected ${name} to be a valid URL.`);
  }
}

export const sharedEnv = {
  supabaseUrl: readRequiredUrl(
    "NEXT_PUBLIC_SUPABASE_URL",
    "Supabase URL",
  ),
} as const;

export { readRequiredString };
