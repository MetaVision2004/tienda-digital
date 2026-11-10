export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const deploymentHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const candidate = configuredUrl || (deploymentHost ? `https://${deploymentHost}` : "http://localhost:3000");
  const url = new URL(candidate);

  if (!(["https:", "http:"] as string[]).includes(url.protocol) || url.username || url.password) {
    throw new Error("NEXT_PUBLIC_SITE_URL debe ser una URL HTTP(S) válida.");
  }

  return new URL(url.origin);
}