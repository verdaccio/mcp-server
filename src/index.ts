#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerPackageTools } from "./tools/packages.js";
import { registerAuthTools } from "./tools/auth.js";
import { registerProfileTools } from "./tools/profile.js";
import { registerTokenTools } from "./tools/tokens.js";
import { registerPublishTools } from "./tools/publish.js";

const server = new McpServer({
  name: "@verdaccio/mcp-server",
  version: "1.0.0",
});

registerPackageTools(server);
registerAuthTools(server);
registerProfileTools(server);
registerTokenTools(server);
registerPublishTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
