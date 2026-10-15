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

const notFound = () => makeResponse({ error: "not found" }, false, 404);

function sentBody(call: number) {
  return JSON.parse(fetchMock.mock.calls[call][1].body as string);
}

describe("publish_package", () => {
  beforeEach(() => fetchMock.mockReset());

  it("publishes a new package and returns success message", async () => {
    fetchMock
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(makeResponse({ ok: true }));

    const { client } = await createTestClient(registerPublishTools);
    const text = await callTool(client, "publish_package", {
      name: "my-lib",
      version: "1.0.0",
    });

    expect(text).toContain("Published my-lib@1.0.0 successfully");
    expect(text).toContain("tag: latest");
    expect(sentBody(1)["dist-tags"]).toEqual({ latest: "1.0.0" });
  });

  it("uses the provided dist-tag", async () => {
    fetchMock
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(makeResponse({ ok: true }));

    const { client } = await createTestClient(registerPublishTools);
    const text = await callTool(client, "publish_package", {
      name: "my-lib",
      version: "2.0.0-beta.1",
      tag: "beta",
    });

    expect(text).toContain("tag: beta");
    expect(sentBody(1)["dist-tags"]).toEqual({ beta: "2.0.0-beta.1" });
  });

  it("encodes scoped package name in the request URL", async () => {
    fetchMock
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(makeResponse({ ok: true }));

    const { client } = await createTestClient(registerPublishTools);
    await callTool(client, "publish_package", {
      name: "@myorg/ui",
      version: "1.0.0",
    });

    expect(fetchMock.mock.calls[1][0] as string).toContain("@myorg%2Fui");
  });

  it("reports an update when the package already exists", async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse({ versions: { "1.0.0": {} } }))
      .mockResolvedValueOnce(makeResponse({ ok: true }));

    const { client } = await createTestClient(registerPublishTools);
    const text = await callTool(client, "publish_package", {
      name: "my-lib",
      version: "1.1.0",
    });

    expect(text).toContain("Updated my-lib@1.1.0 successfully");
  });

  it("refuses to re-publish an existing version", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ versions: { "1.0.0": {} } })
    );

    const { client } = await createTestClient(registerPublishTools);
    const text = await callTool(client, "publish_package", {
      name: "my-lib",
      version: "1.0.0",
    });

    expect(text).toContain("already published");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops when the existence check fails for reasons other than 404", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({}, false, 401));

    const { client } = await createTestClient(registerPublishTools);
    const text = await callTool(client, "publish_package", {
      name: "my-lib",
      version: "1.0.0",
    });

    expect(text).toContain("Failed to check existing package: 401");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns error on publish failure", async () => {
    fetchMock
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(makeResponse({ error: "conflict" }, false, 409));

    const { client } = await createTestClient(registerPublishTools);
    const text = await callTool(client, "publish_package", {
      name: "my-lib",
      version: "1.0.0",
    });

    expect(text).toContain("Publish failed: 409");
  });
});

describe("unpublish_package", () => {
  beforeEach(() => fetchMock.mockReset());

  const manifest = (versions: string[], tags: Record<string, string>) => ({
    _id: "my-lib",
    _rev: "3-abc",
    name: "my-lib",
    versions: Object.fromEntries(
      versions.map((v) => [
        v,
        { dist: { tarball: `http://localhost/my-lib/-/my-lib-${v}.tgz` } },
      ])
    ),
    "dist-tags": tags,
    time: Object.fromEntries(versions.map((v) => [v, "2026-01-01"])),
  });

  it("removes the version, moves latest to the highest stable version and deletes the tarball", async () => {
    fetchMock
      .mockResolvedValueOnce(
        makeResponse(
          manifest(["1.0.0", "1.1.0", "2.0.0-beta.1"], {
            latest: "1.1.0",
            beta: "2.0.0-beta.1",
          })
        )
      )
      .mockResolvedValueOnce(makeResponse({ ok: true }))
      .mockResolvedValueOnce(makeResponse({ _rev: "4-def" }))
      .mockResolvedValueOnce(makeResponse({ ok: true }));

    const { client } = await createTestClient(registerPublishTools);
    const text = await callTool(client, "unpublish_package", {
      name: "my-lib",
      version: "1.1.0",
    });

    expect(text).toContain("Unpublished my-lib@1.1.0 successfully");
    const put = sentBody(1);
    expect(Object.keys(put.versions)).toEqual(["1.0.0", "2.0.0-beta.1"]);
    expect(put["dist-tags"]).toEqual({
      latest: "1.0.0",
      beta: "2.0.0-beta.1",
    });
    expect(put.time["1.1.0"]).toBeUndefined();
    expect(fetchMock.mock.calls[1][0]).toContain("/my-lib/-rev/3-abc");
    expect(fetchMock.mock.calls[3][0]).toContain(
      "/my-lib/-/my-lib-1.1.0.tgz/-rev/4-def"
    );
    expect(fetchMock.mock.calls[3][1].method).toBe("DELETE");
  });

  it("drops non-latest tags that pointed at the removed version", async () => {
    fetchMock
      .mockResolvedValueOnce(
        makeResponse(
          manifest(["1.0.0", "2.0.0-beta.1"], {
            latest: "1.0.0",
            beta: "2.0.0-beta.1",
          })
        )
      )
      .mockResolvedValueOnce(makeResponse({ ok: true }))
      .mockResolvedValueOnce(makeResponse({ _rev: "4-def" }))
      .mockResolvedValueOnce(makeResponse({ ok: true }));

    const { client } = await createTestClient(registerPublishTools);
    await callTool(client, "unpublish_package", {
      name: "my-lib",
      version: "2.0.0-beta.1",
    });

    expect(sentBody(1)["dist-tags"]).toEqual({ latest: "1.0.0" });
  });

  it("removes the whole package when unpublishing the last version", async () => {
    fetchMock
      .mockResolvedValueOnce(
        makeResponse(manifest(["1.0.0"], { latest: "1.0.0" }))
      )
      .mockResolvedValueOnce(makeResponse({ ok: true }));

    const { client } = await createTestClient(registerPublishTools);
    const text = await callTool(client, "unpublish_package", {
      name: "my-lib",
      version: "1.0.0",
    });

    expect(text).toContain("the package was removed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain("/my-lib/-rev/3-abc");
    expect(fetchMock.mock.calls[1][1].method).toBe("DELETE");
  });

  it("reports a missing version", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse(manifest(["1.0.0"], { latest: "1.0.0" }))
    );

    const { client } = await createTestClient(registerPublishTools);
    const text = await callTool(client, "unpublish_package", {
      name: "my-lib",
      version: "9.9.9",
    });

    expect(text).toContain("Version 9.9.9 not found");
  });

  it("reports when the tarball deletion fails after updating metadata", async () => {
    fetchMock
      .mockResolvedValueOnce(
        makeResponse(
          manifest(["1.0.0", "1.1.0"], { latest: "1.1.0" })
        )
      )
      .mockResolvedValueOnce(makeResponse({ ok: true }))
      .mockResolvedValueOnce(makeResponse({ _rev: "4-def" }))
      .mockResolvedValueOnce(makeResponse({}, false, 500));

    const { client } = await createTestClient(registerPublishTools);
    const text = await callTool(client, "unpublish_package", {
      name: "my-lib",
      version: "1.1.0",
    });

    expect(text).toContain("Metadata updated but tarball deletion failed: 500");
  });
});
