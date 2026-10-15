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
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("PUT");
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from("alice:secret").toString("base64")}`
    );
  });

  it("says so when the server created the user instead", async () => {
    fetchMock.mockResolvedValue(
      makeResponse({ ok: "user 'bob' created", token: "abc123" })
    );

    const { client } = await createTestClient(registerAuthTools);
    const text = await callTool(client, "login", {
      username: "bob",
      password: "secret",
    });

    expect(text).toContain("User 'bob' did not exist and was created");
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

    expect(text).toContain("no token was returned");
  });
});

describe("add_user", () => {
  beforeEach(() => fetchMock.mockReset());

  it("registers the user and returns the token", async () => {
    fetchMock.mockResolvedValue(
      makeResponse({ ok: "user 'alice' created", token: "abc123" })
    );

    const { client } = await createTestClient(registerAuthTools);
    const text = await callTool(client, "add_user", {
      username: "alice",
      password: "secret",
    });

    expect(text).toContain("User 'alice' created successfully");
    expect(text).toContain("abc123");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/-/user/org.couchdb.user%3Aalice");
    expect(JSON.parse(init.body)).toMatchObject({
      name: "alice",
      password: "secret",
    });
  });

  it("returns the server error on conflict", async () => {
    fetchMock.mockResolvedValue(
      makeResponse({ error: "username is already registered" }, false, 409)
    );

    const { client } = await createTestClient(registerAuthTools);
    const text = await callTool(client, "add_user", {
      username: "alice",
      password: "secret",
    });

    expect(text).toContain("Registration failed: 409");
    expect(text).toContain("already registered");
  });
});
