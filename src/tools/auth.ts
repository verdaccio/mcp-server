import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { USER_API_ENDPOINTS } from "@verdaccio/middleware";
import { z } from "zod";
import { buildHeaders, resolveEndpoint, setToken } from "../client.js";

const body = (username: string, password: string) =>
  JSON.stringify({
    name: username,
    password,
    type: "user",
    roles: [],
    date: new Date().toISOString(),
  });

export function registerAuthTools(server: McpServer): void {
  // Register a new user in Verdaccio (add_user path)
  server.registerTool(
    "add_user",
    {
      description:
        "Register a new user in the Verdaccio registry. Returns a Bearer token on success.",
      inputSchema: {
        username: z.string().describe("Desired username"),
        password: z.string().describe("Desired password"),
      },
    },
    async ({ username, password }) => {
      const url = await resolveEndpoint(USER_API_ENDPOINTS.add_user, {
        org_couchdb_user: `org.couchdb.user:${username}`,
      });

      const response = await fetch(url, {
        method: "PUT",
        headers: buildHeaders(),
        body: body(username, password),
      });

      if (!response.ok) {
        const text = await response.text();
        return {
          content: [
            {
              type: "text",
              text: `Registration failed: ${response.status} ${response.statusText}\n${text}`,
            },
          ],
        };
      }

      const data = (await response.json()) as { token?: string; ok?: string };

      if (data.token) {
        setToken(data.token);
      }

      return {
        content: [
          {
            type: "text",
            text: data.token
              ? `User '${username}' created successfully.\nToken: ${data.token}`
              : `User '${username}' created but no token was returned.`,
          },
        ],
      };
    }
  );

  // Basic auth makes remote_user match the body name, hitting Verdaccio's authenticate branch.
  // Unknown users still fall through to add_user, as with `npm login`.
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
      const url = await resolveEndpoint(USER_API_ENDPOINTS.add_user, {
        org_couchdb_user: `org.couchdb.user:${username}`,
      });

      const basicToken = Buffer.from(`${username}:${password}`).toString(
        "base64"
      );
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Basic ${basicToken}`,
        },
        body: body(username, password),
      });

      if (!response.ok) {
        const text = await response.text();
        return {
          content: [
            {
              type: "text",
              text: `Login failed: ${response.status} ${response.statusText}\n${text}`,
            },
          ],
        };
      }

      const data = (await response.json()) as {
        token?: string;
        ok?: string;
      };

      if (!data.token) {
        return {
          content: [
            {
              type: "text",
              text: "Login succeeded but no token was returned.",
            },
          ],
        };
      }

      setToken(data.token);
      const created = data.ok?.includes("created") ?? false;
      return {
        content: [
          {
            type: "text",
            text: `${created ? `User '${username}' did not exist and was created.` : "Logged in successfully."}\nToken: ${data.token}`,
          },
        ],
      };
    }
  );
}
