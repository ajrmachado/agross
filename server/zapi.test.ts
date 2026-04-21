import { describe, it, expect } from "vitest";

// Validates Z-API credentials by checking instance status
describe("Z-API credentials", () => {
  it("should connect to Z-API with valid credentials", async () => {
    const instanceId = process.env.ZAPI_INSTANCE_ID ?? "3F18FFC8C545724F12A9AAE399BC1248";
    const token = process.env.ZAPI_TOKEN ?? "F7BAA78858C225A7B40F4EB4";
    const clientToken = process.env.ZAPI_CLIENT_TOKEN ?? "Fb04e65161b284c8dbdb19f07554fdc1fS";

    const res = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/status`,
      {
        headers: {
          "Client-Token": clientToken,
          "Content-Type": "application/json",
        },
      }
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    // The response should NOT contain an auth error
    expect(data.error).not.toBe("your client-token is not configured");
    // Should have a 'connected' field (even if false — instance not yet paired)
    expect(typeof data.connected).toBe("boolean");
  });
});
