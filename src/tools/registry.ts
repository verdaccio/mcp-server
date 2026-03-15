import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getRegistryUrl } from "../client.js";

export function registerRegistryTools(server: McpServer): void {
  server.registerTool(
    "start_registry",
    {
      description:
        "Start the Verdaccio registry (if not already running) and return its URL. " +
        "When no VERDACCIO_URL is configured, an embedded registry is started automatically on a random local port.",
    },
    async () => {
      const url = await getRegistryUrl();
      const embedded = !process.env.VERDACCIO_URL;
      return {
        content: [
          {
            type: "text",
            text: embedded
              ? `Embedded Verdaccio registry is running at ${url}`
              : `Using external Verdaccio registry at ${url}`,
          },
        ],
      };
    }
  );
}
