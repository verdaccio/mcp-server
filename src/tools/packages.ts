import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SEARCH_API_ENDPOINTS, PACKAGE_API_ENDPOINTS } from "@verdaccio/middleware";
import { z } from "zod";
import { buildHeaders, resolveEndpoint } from "../client.js";

export function registerPackageTools(server: McpServer): void {
  // SEARCH_API_ENDPOINTS.search → "/-/v1/search"
  server.registerTool(
    "find_package",
    {
      description:
        "Search for a private package in the Verdaccio registry by name or keyword",
      inputSchema: {
        query: z.string().describe("Package name or search term"),
        size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Max number of results to return (default 20)"),
      },
    },
    async ({ query, size = 20 }) => {
      const base = await resolveEndpoint(SEARCH_API_ENDPOINTS.search);
      const url = `${base}?text=${encodeURIComponent(query)}&size=${size}`;

      const response = await fetch(url, { headers: buildHeaders() });

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Error searching registry: ${response.status} ${response.statusText}`,
            },
          ],
        };
      }

      const data = (await response.json()) as {
        objects: Array<{
          package: {
            name: string;
            version: string;
            description?: string;
            keywords?: string[];
            date?: string;
            author?: { name?: string };
          };
        }>;
        total: number;
      };

      if (data.objects.length === 0) {
        return {
          content: [{ type: "text", text: `No packages found for "${query}"` }],
        };
      }

      const results = data.objects.map(({ package: pkg }) => {
        const lines = [`**${pkg.name}** @ ${pkg.version}`];
        if (pkg.description) lines.push(`  ${pkg.description}`);
        if (pkg.author?.name) lines.push(`  Author: ${pkg.author.name}`);
        if (pkg.keywords?.length)
          lines.push(`  Keywords: ${pkg.keywords.join(", ")}`);
        if (pkg.date) lines.push(`  Published: ${pkg.date}`);
        return lines.join("\n");
      });

      return {
        content: [
          {
            type: "text",
            text: `Found ${data.total} package(s) matching "${query}":\n\n${results.join("\n\n")}`,
          },
        ],
      };
    }
  );

  // PACKAGE_API_ENDPOINTS.get_package_by_version → "/:package{/:version}"
  server.registerTool(
    "get_package",
    {
      description:
        "Get detailed metadata for a specific package (and optionally a specific version) from Verdaccio",
      inputSchema: {
        package: z
          .string()
          .describe("Package name, e.g. my-lib or @scope/my-lib"),
        version: z
          .string()
          .optional()
          .describe("Specific version, e.g. 1.2.3 (omit for latest)"),
      },
    },
    async ({ package: pkg, version }) => {
      const params: Record<string, string> = { package: pkg };
      if (version) params.version = version;

      const url = await resolveEndpoint(
        PACKAGE_API_ENDPOINTS.get_package_by_version,
        params
      );

      const response = await fetch(url, { headers: buildHeaders() });

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Package not found: ${response.status} ${response.statusText}`,
            },
          ],
        };
      }

      const data = (await response.json()) as {
        name: string;
        description?: string;
        "dist-tags"?: Record<string, string>;
        versions?: Record<
          string,
          { description?: string; dependencies?: Record<string, string> }
        >;
        author?: { name?: string; email?: string };
        license?: string;
        keywords?: string[];
      };

      const lines: string[] = [`**${data.name}**`];
      if (data.description) lines.push(`Description: ${data.description}`);
      if (data.author?.name)
        lines.push(
          `Author: ${data.author.name}${data.author.email ? ` <${data.author.email}>` : ""}`
        );
      if (data.license) lines.push(`License: ${data.license}`);
      if (data.keywords?.length)
        lines.push(`Keywords: ${data.keywords.join(", ")}`);

      if (data["dist-tags"]) {
        const tags = Object.entries(data["dist-tags"])
          .map(([tag, ver]) => `${tag}: ${ver}`)
          .join(", ");
        lines.push(`Dist-tags: ${tags}`);
      }

      if (data.versions) {
        const versionList = Object.keys(data.versions).slice(-10).reverse();
        lines.push(`Recent versions: ${versionList.join(", ")}`);
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    }
  );
}
