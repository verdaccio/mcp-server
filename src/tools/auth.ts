import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { USER_API_ENDPOINTS } from "@verdaccio/middleware";
import { z } from "zod";
import { buildHeaders, resolveEndpoint } from "../client.js";

export function registerAuthTools(server: McpServer): void {
  // USER_API_ENDPOINTS.add_user → "/-/user/:org_couchdb_user{/:_rev}{/:revision}"
  server.registerTool(
    "login",
    {
      description:
        "Authenticate with the Verdaccio registry using username and password. Returns a Bearer token.",
      inputSchema: {
        username: z.string().describe("Verdaccio username"),
        password: z.string().describe("Verdaccio password"),
      },
    },
    async ({ username, password }) => {
      const url = resolveEndpoint(USER_API_ENDPOINTS.add_user, {
        org_couchdb_user: `org.couchdb.user:${username}`,
      });

      const response = await fetch(url, {
        method: "PUT",
        headers: buildHeaders(),
        body: JSON.stringify({
          name: username,
          password,
          type: "user",
          roles: [],
          date: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Login failed: ${response.status} ${response.statusText}`,
            },
          ],
        };
      }

      const data = (await response.json()) as { token?: string; ok?: string };

      if (!data.token) {
        return {
          content: [
            { type: "text", text: `Login succeeded but no token returned` },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Logged in successfully.\nToken: ${data.token}`,
          },
        ],
      };
    }
  );
}
