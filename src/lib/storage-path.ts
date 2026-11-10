export function isCompanyStoragePath(filePath: string, companyId: string) {
  if (!filePath || filePath.startsWith("/") || filePath.includes("\\")) return false;
  const [owner, ...segments] = filePath.split("/");
  return owner === companyId && segments.length > 0 && segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}