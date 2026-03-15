import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { generatePackageMetadata } from "@verdaccio/test-helper";
import { z } from "zod";
import { buildHeaders, getRegistryUrl } from "../client.js";

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
      const payload = generatePackageMetadata(name, version, { distTag: tag });

      // Encode scoped package name for URL: @scope/name → @scope%2Fname
      const encodedName = name.replace("/", "%2F");
      const url = `${await getRegistryUrl()}/${encodedName}`;

      const response = await fetch(url, {
        method: "PUT",
        headers: buildHeaders(),
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

      return {
        content: [
          {
            type: "text",
            text: `Published ${name}@${version} successfully (tag: ${tag})`,
          },
        ],
      };
    }
  );
}
