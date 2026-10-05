export const SMTP_CONFIG = Object.freeze({
  host: "smtp.zoho.com",
  port: 587,
  secure: false,
  requireTLS: true,
});

export function smtpSettings(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  const user = env.ZOHO_EMAIL?.trim();
  const password = env.ZOHO_PASSWORD;
  if (!user || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user) || !password?.trim())
    return null;
  return { ...SMTP_CONFIG, user, password };
}
