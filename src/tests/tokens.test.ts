import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerTokenTools } from "../tools/tokens.js";
import { createTestClient, callTool } from "./helpers.js";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function makeResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Bad Request",
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

describe("list_tokens", () => {
  beforeEach(() => fetchMock.mockReset());

  it("returns formatted token list", async () => {
    fetchMock.mockResolvedValue(
      makeResponse({
        objects: [
          {
            key: "key1",
            token: "tok_abc",
            user: "alice",
            readonly: false,
            created: "2024-01-01",
          },
        ],
      })
    );

    const { client } = await createTestClient(registerTokenTools);
    const text = await callTool(client, "list_tokens");

    expect(text).toContain("tok_abc");
    expect(text).toContain("alice");
  });

  it("returns no-tokens message when list is empty", async () => {
    fetchMock.mockResolvedValue(makeResponse({ objects: [] }));

    const { client } = await createTestClient(registerTokenTools);
    const text = await callTool(client, "list_tokens");

    expect(text).toContain("No tokens found.");
  });
});

describe("create_token", () => {
  beforeEach(() => fetchMock.mockReset());

  it("returns created token details", async () => {
    fetchMock.mockResolvedValue(
      makeResponse({
        token: "tok_new",
        key: "key2",
        readonly: true,
        created: "2024-06-01",
      })
    );

    const { client } = await createTestClient(registerTokenTools);
    const text = await callTool(client, "create_token", {
      password: "secret",
      readonly: true,
    });

    expect(text).toContain("Token created successfully");
    expect(text).toContain("tok_new");
    expect(text).toContain("key2");
  });

  it("returns error on failure", async () => {
    fetchMock.mockResolvedValue(makeResponse({}, false, 400));

    const { client } = await createTestClient(registerTokenTools);
    const text = await callTool(client, "create_token", { password: "bad" });

    expect(text).toContain("Failed to create token: 400");
  });
});

describe("delete_token", () => {
  beforeEach(() => fetchMock.mockReset());

  it("returns success message", async () => {
    fetchMock.mockResolvedValue(makeResponse({}));

    const { client } = await createTestClient(registerTokenTools);
    const text = await callTool(client, "delete_token", { tokenKey: "key1" });

    expect(text).toContain("key1 deleted successfully");
  });

  it("returns error on failure", async () => {
    fetchMock.mockResolvedValue(makeResponse({}, false, 404));

    const { client } = await createTestClient(registerTokenTools);
    const text = await callTool(client, "delete_token", { tokenKey: "key1" });

    expect(text).toContain("Failed to delete token: 404");
  });
});
