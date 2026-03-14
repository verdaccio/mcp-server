import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

/**
 * Creates a connected McpServer + Client pair using InMemoryTransport.
 * Pass a setup function to register tools on the server before connecting.
 */
export async function createTestClient(
  setup: (server: McpServer) => void
): Promise<{ client: Client; server: McpServer }> {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  setup(server);

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  const client = new Client({ name: "test-client", version: "0.0.0" });

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return { client, server };
}

/**
 * Call a tool and return the first text content block.
 */
export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown> = {}
): Promise<string> {
  const result = await client.callTool({ name, arguments: args });
  const first = (result.content as Array<{ type: string; text: string }>)[0];
  return first?.text ?? "";
}
