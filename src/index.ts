#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from "node:module";
import { registerRegistryTools } from "./tools/registry.js";
import { registerPackageTools } from "./tools/packages.js";
import { registerAuthTools } from "./tools/auth.js";
import { registerProfileTools } from "./tools/profile.js";
import { registerTokenTools } from "./tools/tokens.js";
import { registerPublishTools } from "./tools/publish.js";

const { version } = createRequire(import.meta.url)("../package.json") as {
  version: string;
};

const server = new McpServer({
  name: "@verdaccio/mcp-server",
  version,
});

registerRegistryTools(server);
registerPackageTools(server);
registerAuthTools(server);
registerProfileTools(server);
registerTokenTools(server);
registerPublishTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
