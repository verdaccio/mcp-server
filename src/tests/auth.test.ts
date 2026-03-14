import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerAuthTools } from "../tools/auth.js";
import { createTestClient, callTool } from "./helpers.js";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function makeResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Unauthorized",
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

describe("login", () => {
  beforeEach(() => fetchMock.mockReset());

  it("returns token on successful login", async () => {
    fetchMock.mockResolvedValue(
      makeResponse({ ok: "you are authenticated as 'alice'", token: "abc123" })
    );

    const { client } = await createTestClient(registerAuthTools);
    const text = await callTool(client, "login", {
      username: "alice",
      password: "secret",
    });

    expect(text).toContain("Logged in successfully");
    expect(text).toContain("abc123");
  });

  it("returns error on failed login", async () => {
    fetchMock.mockResolvedValue(makeResponse({}, false, 401));

    const { client } = await createTestClient(registerAuthTools);
    const text = await callTool(client, "login", {
      username: "alice",
      password: "wrong",
    });

    expect(text).toContain("Login failed: 401");
  });

  it("handles response with no token", async () => {
    fetchMock.mockResolvedValue(makeResponse({ ok: "done" }));

    const { client } = await createTestClient(registerAuthTools);
    const text = await callTool(client, "login", {
      username: "alice",
      password: "secret",
    });

    expect(text).toContain("no token returned");
  });
});
