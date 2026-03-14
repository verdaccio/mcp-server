import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerPublishTools } from "../tools/publish.js";
import { createTestClient, callTool } from "./helpers.js";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function makeResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Conflict",
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

describe("publish_package", () => {
  beforeEach(() => fetchMock.mockReset());

  it("publishes a package and returns success message", async () => {
    fetchMock.mockResolvedValue(makeResponse({ ok: true }));

    const { client } = await createTestClient(registerPublishTools);
    const text = await callTool(client, "publish_package", {
      name: "my-lib",
      version: "1.0.0",
    });

    expect(text).toContain("Published my-lib@1.0.0 successfully");
    expect(text).toContain("tag: latest");
  });

  it("uses the provided dist-tag", async () => {
    fetchMock.mockResolvedValue(makeResponse({ ok: true }));

    const { client } = await createTestClient(registerPublishTools);
    const text = await callTool(client, "publish_package", {
      name: "my-lib",
      version: "2.0.0-beta.1",
      tag: "beta",
    });

    expect(text).toContain("tag: beta");
  });

  it("encodes scoped package name in the request URL", async () => {
    fetchMock.mockResolvedValue(makeResponse({ ok: true }));

    const { client } = await createTestClient(registerPublishTools);
    await callTool(client, "publish_package", {
      name: "@myorg/ui",
      version: "1.0.0",
    });

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("@myorg%2Fui");
  });

  it("returns error on publish failure", async () => {
    fetchMock.mockResolvedValue(makeResponse({ error: "conflict" }, false, 409));

    const { client } = await createTestClient(registerPublishTools);
    const text = await callTool(client, "publish_package", {
      name: "my-lib",
      version: "1.0.0",
    });

    expect(text).toContain("Publish failed: 409");
  });
});
