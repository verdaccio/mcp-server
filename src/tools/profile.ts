import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PROFILE_API_ENDPOINTS } from "@verdaccio/middleware";
import { buildHeaders, resolveEndpoint } from "../client.js";

export function registerProfileTools(server: McpServer): void {
  // PROFILE_API_ENDPOINTS.get_profile → "/-/npm/v1/user"
  server.registerTool(
    "get_profile",
    {
      description:
        "Get the profile of the currently authenticated user in Verdaccio",
    },
    async () => {
      const url = resolveEndpoint(PROFILE_API_ENDPOINTS.get_profile);
      const response = await fetch(url, { headers: buildHeaders() });

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get profile: ${response.status} ${response.statusText}`,
            },
          ],
        };
      }

      const data = (await response.json()) as {
        name?: string;
        email?: string;
        fullname?: string;
        cidr_whitelist?: string[];
      };

      const lines: string[] = ["**Profile**"];
      if (data.name) lines.push(`Username: ${data.name}`);
      if (data.fullname) lines.push(`Full name: ${data.fullname}`);
      if (data.email) lines.push(`Email: ${data.email}`);
      if (data.cidr_whitelist?.length)
        lines.push(`CIDR whitelist: ${data.cidr_whitelist.join(", ")}`);

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    }
  );
}
