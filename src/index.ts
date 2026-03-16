#!/usr/bin/env node
/**
 * Freepik Spaces MCP Server
 *
 * TypeScript MCP Server für Freepik Pikaso Spaces.
 * Verbindet sich über Chrome DevTools Protocol (CDP) mit dem Browser
 * und steuert Nodes, Verbindungen und Workflows.
 *
 * Kein Playwright, kein Browser-Start — nutzt den laufenden Chrome-Browser.
 *
 * Voraussetzung:
 *   Chrome mit --remote-debugging-port=9222 starten
 *   Freepik Spaces Tab öffnen
 *
 * Verwendung:
 *   node dist/index.js              # stdio Transport
 *   CDP_PORT=9222 node dist/index.js
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerNodeTools } from "./tools/nodes.js";
import { registerWorkflowTools } from "./tools/workflow.js";

// ─── Server erstellen ────────────────────────────────────────

const server = new McpServer({
  name: "freepik-spaces-mcp-server",
  version: "1.0.0",
});

// ─── Tools registrieren ──────────────────────────────────────

registerNodeTools(server);
registerWorkflowTools(server);

// ─── Server starten ──────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("freepik-spaces-mcp-server läuft (stdio)");
  console.error(`CDP-Verbindung: ${process.env.CDP_HOST || "127.0.0.1"}:${process.env.CDP_PORT || "9222"}`);
}

main().catch(error => {
  console.error("Server-Fehler:", error);
  process.exit(1);
});
