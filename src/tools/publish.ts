import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { generatePackageMetadata } from "@verdaccio/test-helper";
import semver from "semver";
import { z } from "zod";
import { buildHeaders, getRegistryUrl } from "../client.js";

function encodePackageName(name: string): string {
  return name.replace("/", "%2F");
}

export function registerPublishTools(server: McpServer): void {
  // PUBLISH_API_ENDPOINTS.add_package → "/:package"
  server.registerTool(
    "publish_package",
    {
      description:
        "Publish a package to the Verdaccio registry by name and version. Generates the required package metadata automatically.",
      inputSchema: {
        name: z
          .string()
          .describe("Package name, e.g. my-lib or @scope/my-lib"),
        version: z.string().describe("Version to publish, e.g. 1.0.0"),
        tag: z
          .string()
          .optional()
          .describe("Dist-tag to apply (default: latest)"),
      },
    },
    async ({ name, version, tag = "latest" }) => {
      const baseUrl = await getRegistryUrl();
      const encodedName = encodePackageName(name);
      const headers = buildHeaders();

      // Check if the package already exists and if the version is already published
      const metaRes = await fetch(
        `${baseUrl}/${encodedName}`,
        { headers }
      );

      if (!metaRes.ok && metaRes.status !== 404) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to check existing package: ${metaRes.status} ${metaRes.statusText}`,
            },
          ],
        };
      }

      if (metaRes.ok) {
        const metadata = (await metaRes.json()) as {
          versions?: Record<string, unknown>;
        };
        if (metadata.versions?.[version]) {
          return {
            content: [
              {
                type: "text",
                text: `Version ${version} of ${name} is already published. Use a different version number.`,
              },
            ],
          };
        }
      }

      const payload = generatePackageMetadata(name, version, { [tag]: version });
      const url = `${baseUrl}/${encodedName}`;

      const response = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text();
        return {
          content: [
            {
              type: "text",
              text: `Publish failed: ${response.status} ${response.statusText}\n${body}`,
            },
          ],
        };
      }

      const isNew = !metaRes.ok;
      return {
        content: [
          {
            type: "text",
            text: `${isNew ? "Published" : "Updated"} ${name}@${version} successfully (tag: ${tag})`,
          },
        ],
      };
    }
  );

  // Unpublish: 3-step flow
  // 1. GET /:package?write=true  → fetch metadata + _rev
  // 2. PUT /:package/-rev/:rev   → send metadata without the target version
  // 3. DELETE /:package/-/:tarball/-rev/:rev → remove the tarball
  server.registerTool(
    "unpublish_package",
    {
      description:
        "Unpublish a specific version of a package from the Verdaccio registry. " +
        "Removes the version from metadata and deletes its tarball.",
      inputSchema: {
        name: z
          .string()
          .describe("Package name, e.g. my-lib or @scope/my-lib"),
        version: z
          .string()
          .describe("Version to unpublish, e.g. 1.0.3"),
      },
    },
    async ({ name, version }) => {
      const baseUrl = await getRegistryUrl();
      const encodedName = encodePackageName(name);
      const headers = buildHeaders();

      // Step 1: Fetch current metadata
      const metaRes = await fetch(
        `${baseUrl}/${encodedName}?write=true`,
        { headers }
      );

      if (!metaRes.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Package not found: ${metaRes.status} ${metaRes.statusText}`,
            },
          ],
        };
      }

      const metadata = (await metaRes.json()) as {
        _id: string;
        _rev: string;
        name: string;
        versions: Record<string, Record<string, unknown>>;
        "dist-tags": Record<string, string>;
        time?: Record<string, string>;
        _attachments?: Record<string, unknown>;
      };

      if (!metadata.versions[version]) {
        return {
          content: [
            {
              type: "text",
              text: `Version ${version} not found in ${name}`,
            },
          ],
        };
      }

      const rev = metadata._rev;

      // Determine the tarball filename from the version metadata
      const versionMeta = metadata.versions[version] as {
        dist?: { tarball?: string };
      };
      const tarballUrl = versionMeta?.dist?.tarball;
      // Extract filename e.g. "test1-1.0.3.tgz" from the full tarball URL
      const tarballFilename = tarballUrl
        ? tarballUrl.split("/").pop()
        : `${name.replace(/^@[^/]+\//, "")}-${version}.tgz`;

      // Removing the last version deletes the whole package, as npm does
      if (Object.keys(metadata.versions).length === 1) {
        const delPkgRes = await fetch(`${baseUrl}/${encodedName}/-rev/${rev}`, {
          method: "DELETE",
          headers,
        });
        if (!delPkgRes.ok) {
          const body = await delPkgRes.text();
          return {
            content: [
              {
                type: "text",
                text: `Failed to remove package: ${delPkgRes.status} ${delPkgRes.statusText}\n${body}`,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `Unpublished ${name}@${version}; it was the last version, so the package was removed`,
            },
          ],
        };
      }

      // Step 2: Send mutated metadata without the target version
      delete metadata.versions[version];
      if (metadata.time) {
        delete metadata.time[version];
      }
      if (metadata._attachments) {
        delete metadata._attachments[tarballFilename!];
      }

      // Drop tags that pointed at the version; latest falls back to the highest remaining
      const distTags = metadata["dist-tags"];
      for (const [tag, tagVersion] of Object.entries(distTags)) {
        if (tagVersion === version) {
          delete distTags[tag];
        }
      }
      if (!distTags.latest) {
        const remaining = Object.keys(metadata.versions);
        const highest =
          semver.maxSatisfying(remaining, "*") ?? semver.rsort(remaining)[0];
        if (highest) {
          distTags.latest = highest;
        }
      }

      const putRes = await fetch(
        `${baseUrl}/${encodedName}/-rev/${rev}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify(metadata),
        }
      );

      if (!putRes.ok) {
        const body = await putRes.text();
        return {
          content: [
            {
              type: "text",
              text: `Failed to update metadata: ${putRes.status} ${putRes.statusText}\n${body}`,
            },
          ],
        };
      }

      // Re-fetch to get the updated _rev for the DELETE step
      const updatedMetaRes = await fetch(
        `${baseUrl}/${encodedName}?write=true`,
        { headers }
      );
      const updatedRev = updatedMetaRes.ok
        ? ((await updatedMetaRes.json()) as { _rev: string })._rev
        : rev;

      // Step 3: Delete the tarball
      const delRes = await fetch(
        `${baseUrl}/${encodedName}/-/${tarballFilename}/-rev/${updatedRev}`,
        {
          method: "DELETE",
          headers,
        }
      );

      if (!delRes.ok) {
        const body = await delRes.text();
        return {
          content: [
            {
              type: "text",
              text: `Metadata updated but tarball deletion failed: ${delRes.status} ${delRes.statusText}\n${body}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Unpublished ${name}@${version} successfully`,
          },
        ],
      };
    }
  );
}
