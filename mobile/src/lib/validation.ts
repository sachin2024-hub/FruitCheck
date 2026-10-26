export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

/** Supabase Auth needs an email, so a username is stored as a private placeholder address. */
const USERNAME_DOMAIN = 'fruitcheck.app';
export const isUsername = (s: string) => /^[a-z0-9._]{3,20}$/i.test(s.trim());
export const usernameToEmail = (s: string) => `${s.trim().toLowerCase()}@${USERNAME_DOMAIN}`;
export const emailToUsername = (email: string | null | undefined) =>
  email?.endsWith(`@${USERNAME_DOMAIN}`) ? email.slice(0, -(USERNAME_DOMAIN.length + 1)) : (email ?? '');

export type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string; tips: string[] };

/** Simple guidance only; Supabase enforces the project's actual password policy. */
export function passwordStrength(pw: string): Strength {
  const checks: [boolean, string][] = [
    [pw.length >= 8, 'at least 8 characters'],
    [/[a-z]/.test(pw) && /[A-Z]/.test(pw), 'upper and lower case letters'],
    [/\d/.test(pw), 'a number'],
    [/[^A-Za-z0-9]/.test(pw), 'a symbol'],
  ];
  const score = checks.filter(([ok]) => ok).length as Strength['score'];
  return {
    score,
    label: ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'][score],
    tips: checks.filter(([ok]) => !ok).map(([, t]) => t),
  };
}

/** Maps Supabase Auth errors to clear messages. */
export function authMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Incorrect username or password.';
  if (m.includes('email not confirmed')) return 'This account is not confirmed yet. Turn off "Confirm email" in Supabase Auth settings.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'That username is already taken. Choose another one.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a moment and try again.';
  if (m.includes('network') || m.includes('fetch')) return 'Could not reach the server. Check your internet connection.';
  return message;
}
