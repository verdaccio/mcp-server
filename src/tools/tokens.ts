import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TOKEN_API_ENDPOINTS } from "@verdaccio/middleware";
import { z } from "zod";
import { buildHeaders, resolveEndpoint } from "../client.js";

export function registerTokenTools(server: McpServer): void {
  // TOKEN_API_ENDPOINTS.get_tokens → "/-/npm/v1/tokens"
  server.registerTool(
    "list_tokens",
    {
      description:
        "List all API tokens for the currently authenticated user in Verdaccio",
    },
    async () => {
      const url = resolveEndpoint(TOKEN_API_ENDPOINTS.get_tokens);
      const response = await fetch(url, { headers: buildHeaders() });

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to list tokens: ${response.status} ${response.statusText}`,
            },
          ],
        };
      }

      const data = (await response.json()) as {
        objects: Array<{
          key: string;
          token: string;
          user: string;
          cidr_whitelist?: string[];
          readonly: boolean;
          created: string;
          updated?: string;
        }>;
      };

      if (data.objects.length === 0) {
        return {
          content: [{ type: "text", text: "No tokens found." }],
        };
      }

      const results = data.objects.map((t) => {
        const lines = [`**${t.token}** (key: ${t.key})`];
        lines.push(`  User: ${t.user}`);
        lines.push(`  Readonly: ${t.readonly}`);
        lines.push(`  Created: ${t.created}`);
        if (t.updated) lines.push(`  Updated: ${t.updated}`);
        if (t.cidr_whitelist?.length)
          lines.push(`  CIDR: ${t.cidr_whitelist.join(", ")}`);
        return lines.join("\n");
      });

      return {
        content: [{ type: "text", text: results.join("\n\n") }],
      };
    }
  );

  // TOKEN_API_ENDPOINTS.get_tokens → "/-/npm/v1/tokens" (POST to create)
  server.registerTool(
    "create_token",
    {
      description:
        "Create a new API token for the currently authenticated user in Verdaccio",
      inputSchema: {
        password: z
          .string()
          .describe(
            "Current user password (required by Verdaccio to create tokens)"
          ),
        readonly: z
          .boolean()
          .optional()
          .describe("Whether the token should be read-only (default false)"),
        cidr: z
          .array(z.string())
          .optional()
          .describe(
            'CIDR ranges to whitelist for this token, e.g. ["192.168.1.0/24"]'
          ),
      },
    },
    async ({ password, readonly = false, cidr }) => {
      const url = resolveEndpoint(TOKEN_API_ENDPOINTS.get_tokens);

      const response = await fetch(url, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({ password, readonly, cidr_whitelist: cidr ?? [] }),
      });

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to create token: ${response.status} ${response.statusText}`,
            },
          ],
        };
      }

      const data = (await response.json()) as {
        token: string;
        key: string;
        readonly: boolean;
        cidr_whitelist?: string[];
        created: string;
      };

      const lines = [
        "Token created successfully.",
        `Token: ${data.token}`,
        `Key: ${data.key}`,
        `Readonly: ${data.readonly}`,
        `Created: ${data.created}`,
      ];
      if (data.cidr_whitelist?.length)
        lines.push(`CIDR: ${data.cidr_whitelist.join(", ")}`);

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    }
  );

  // TOKEN_API_ENDPOINTS.delete_token → "/-/npm/v1/tokens/token/:tokenKey"
  server.registerTool(
    "delete_token",
    {
      description: "Delete an API token by its key from Verdaccio",
      inputSchema: {
        tokenKey: z
          .string()
          .describe(
            "The token key to delete (not the token value, but the key identifier)"
          ),
      },
    },
    async ({ tokenKey }) => {
      const url = resolveEndpoint(TOKEN_API_ENDPOINTS.delete_token, {
        tokenKey,
      });

      const response = await fetch(url, {
        method: "DELETE",
        headers: buildHeaders(),
      });

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to delete token: ${response.status} ${response.statusText}`,
            },
          ],
        };
      }

      return {
        content: [
          { type: "text", text: `Token ${tokenKey} deleted successfully.` },
        ],
      };
    }
  );
}
