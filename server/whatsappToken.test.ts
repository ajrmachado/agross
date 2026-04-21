/**
 * Tests for whatsappTokenService
 * Tests the token generation, validation, and peek logic using mocked DB.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the DB module ────────────────────────────────────────────────────────
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

const mockDb = {
  insert: vi.fn(() => ({ values: mockInsert })),
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: mockSelect,
      })),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: mockUpdate,
    })),
  })),
  delete: vi.fn(() => ({
    where: mockDelete,
  })),
};

vi.mock("./db", () => ({
  getDb: vi.fn(() => Promise.resolve(mockDb)),
}));

vi.mock("../drizzle/schema", () => ({
  whatsappAccessTokens: { token: "token", userId: "userId", expiresAt: "expiresAt", usedAt: "usedAt" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
  lt: vi.fn((a, b) => ({ field: a, value: b })),
}));

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("whatsappTokenService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateAccessToken", () => {
    it("should return a token string of 64 hex chars", async () => {
      mockInsert.mockResolvedValue(undefined);
      const { generateAccessToken } = await import("./whatsappTokenService");
      const token = await generateAccessToken(1);
      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
      expect(token!.length).toBe(64);
      expect(/^[a-f0-9]+$/.test(token!)).toBe(true);
    });

    it("should return null if DB insert fails", async () => {
      mockInsert.mockRejectedValue(new Error("DB error"));
      const { generateAccessToken } = await import("./whatsappTokenService");
      const token = await generateAccessToken(1);
      expect(token).toBeNull();
    });
  });

  describe("validateAccessToken", () => {
    it("should return not_found for unknown token", async () => {
      mockSelect.mockResolvedValue([]);
      const { validateAccessToken } = await import("./whatsappTokenService");
      const result = await validateAccessToken("nonexistent");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("not_found");
    });

    it("should return expired for past-expiry token", async () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
      mockSelect.mockResolvedValue([{
        token: "abc",
        userId: 1,
        expiresAt: pastDate,
        usedAt: null,
      }]);
      const { validateAccessToken } = await import("./whatsappTokenService");
      const result = await validateAccessToken("abc");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("expired");
    });

    it("should return already_used for consumed token", async () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 12); // 12h from now
      mockSelect.mockResolvedValue([{
        token: "abc",
        userId: 1,
        expiresAt: futureDate,
        usedAt: new Date(), // already used
      }]);
      const { validateAccessToken } = await import("./whatsappTokenService");
      const result = await validateAccessToken("abc");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("already_used");
    });

    it("should return valid and userId for fresh token", async () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 12);
      mockSelect.mockResolvedValue([{
        token: "abc",
        userId: 42,
        expiresAt: futureDate,
        usedAt: null,
      }]);
      mockUpdate.mockResolvedValue(undefined);
      const { validateAccessToken } = await import("./whatsappTokenService");
      const result = await validateAccessToken("abc");
      expect(result.valid).toBe(true);
      expect(result.userId).toBe(42);
    });
  });

  describe("peekAccessToken", () => {
    it("should return valid without consuming the token", async () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 12);
      mockSelect.mockResolvedValue([{
        token: "abc",
        userId: 7,
        expiresAt: futureDate,
        usedAt: null,
      }]);
      const { peekAccessToken } = await import("./whatsappTokenService");
      const result = await peekAccessToken("abc");
      expect(result.valid).toBe(true);
      expect(result.userId).toBe(7);
      // Should NOT call update (no consumption)
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });
});
