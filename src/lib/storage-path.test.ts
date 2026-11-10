import { describe, expect, it } from "vitest";
import { isCompanyStoragePath } from "./storage-path";

describe("company storage paths", () => {
  const companyId = "123e4567-e89b-42d3-a456-426614174000";

  it("accepts a path owned by the company", () => {
    expect(isCompanyStoragePath(`${companyId}/d4f49e71-file.pdf`, companyId)).toBe(true);
  });

  it.each([
    "",
    "/123e4567-e89b-42d3-a456-426614174000/file.pdf",
    "other-company/file.pdf",
    "https://example.com/file.pdf",
    "123e4567-e89b-42d3-a456-426614174000/",
    "123e4567-e89b-42d3-a456-426614174000/../other/file.pdf",
    "123e4567-e89b-42d3-a456-426614174000/./file.pdf",
    "123e4567-e89b-42d3-a456-426614174000\\file.pdf",
  ])("rejects unsafe path %j", (filePath) => {
    expect(isCompanyStoragePath(filePath, companyId)).toBe(false);
  });
});