export function smtpSettings(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  const host = env.SMTP_HOST?.trim();
  const port = Number(env.SMTP_PORT || "465");
  const user = env.ZOHO_EMAIL?.trim();
  const password = env.ZOHO_PASSWORD;
  if (
    !host ||
    !/^[a-z0-9.-]+$/i.test(host) ||
    ![465, 587].includes(port) ||
    !user ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user) ||
    !password?.trim()
  )
    return null;
  return { host, port, secure: port === 465, user, password };
}
