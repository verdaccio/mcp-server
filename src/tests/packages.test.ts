import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerPackageTools } from "../tools/packages.js";
import { createTestClient, callTool } from "./helpers.js";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function makeResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Not Found",
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

describe("find_package", () => {
  beforeEach(() => fetchMock.mockReset());

  it("returns formatted results when packages are found", async () => {
    fetchMock.mockResolvedValue(
      makeResponse({
        total: 1,
        objects: [
          {
            package: {
              name: "@myorg/ui",
              version: "1.2.3",
              description: "UI components",
              author: { name: "Alice" },
              keywords: ["ui", "react"],
              date: "2024-01-01",
            },
          },
        ],
      })
    );

    const { client } = await createTestClient(registerPackageTools);
    const text = await callTool(client, "find_package", { query: "ui" });

    expect(text).toContain("@myorg/ui");
    expect(text).toContain("1.2.3");
    expect(text).toContain("UI components");
    expect(text).toContain("Alice");
  });

  it("returns no-results message when registry returns empty", async () => {
    fetchMock.mockResolvedValue(
      makeResponse({ total: 0, objects: [] })
    );

    const { client } = await createTestClient(registerPackageTools);
    const text = await callTool(client, "find_package", { query: "nope" });

    expect(text).toContain('No packages found for "nope"');
  });

  it("returns error message on non-ok response", async () => {
    fetchMock.mockResolvedValue(makeResponse({}, false, 500));

    const { client } = await createTestClient(registerPackageTools);
    const text = await callTool(client, "find_package", { query: "ui" });

    expect(text).toContain("Error searching registry: 500");
  });
});

describe("get_package", () => {
  beforeEach(() => fetchMock.mockReset());

  it("returns package metadata", async () => {
    fetchMock.mockResolvedValue(
      makeResponse({
        name: "@myorg/ui",
        description: "UI components",
        license: "MIT",
        author: { name: "Alice", email: "alice@example.com" },
        keywords: ["ui"],
        "dist-tags": { latest: "1.2.3" },
        versions: { "1.0.0": {}, "1.2.3": {} },
      })
    );

    const { client } = await createTestClient(registerPackageTools);
    const text = await callTool(client, "get_package", {
      package: "@myorg/ui",
    });

    expect(text).toContain("@myorg/ui");
    expect(text).toContain("MIT");
    expect(text).toContain("alice@example.com");
    expect(text).toContain("latest: 1.2.3");
  });

  it("returns error when package not found", async () => {
    fetchMock.mockResolvedValue(makeResponse({}, false, 404));

    const { client } = await createTestClient(registerPackageTools);
    const text = await callTool(client, "get_package", {
      package: "missing",
    });

    expect(text).toContain("Package not found: 404");
  });
});
