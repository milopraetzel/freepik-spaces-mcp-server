/**
 * Freepik Spaces — Workflow-Orchestrierung
 *
 * High-Level Tools zum Ausführen der kompletten Print Automation Pipeline.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { chrome } from "../services/chrome.js";
import { JS_SNIPPETS } from "../constants.js";

// ─── Schemas ─────────────────────────────────────────────────

const RunPipelineInputSchema = z.object({
  bild_beschreibung: z.string()
    .min(1, "Bild-Beschreibung ist erforderlich")
    .describe("Textbeschreibung des gewünschten Kunstwerks (z.B. 'Abstrakte Komposition mit warmen Farben, Öl auf Leinwand')"),
  raum_beschreibung: z.string()
    .min(1, "Raum-Beschreibung ist erforderlich")
    .describe("Textbeschreibung des Raums für das Mockup (z.B. 'Modernes Wohnzimmer, weiße Wände, Holzboden')"),
  auto_run: z.boolean()
    .default(false)
    .describe("Wenn true, werden die Nodes automatisch der Reihe nach ausgeführt. Wenn false, werden nur die Texte gesetzt."),
  step_timeout_ms: z.number()
    .int()
    .min(5000)
    .max(180000)
    .default(60000)
    .describe("Timeout pro Schritt in Millisekunden (Standard: 60000)"),
}).strict();

const RunSinglePathInputSchema = z.object({
  path: z.enum(["artwork", "raum"])
    .describe("Welcher Pfad ausgeführt werden soll: 'artwork' (Bild→Interpret→Generate→Upscale) oder 'raum' (Raum→Interpret→Generate→Upscale)"),
  beschreibung: z.string()
    .min(1, "Beschreibung ist erforderlich")
    .describe("Textbeschreibung für den gewählten Pfad"),
  auto_run: z.boolean()
    .default(false)
    .describe("Wenn true, werden die Nodes automatisch ausgeführt"),
  step_timeout_ms: z.number()
    .int()
    .min(5000)
    .max(180000)
    .default(60000)
    .describe("Timeout pro Schritt"),
}).strict();

// ─── Hilfsfunktionen ─────────────────────────────────────────

interface NodeInfo {
  id: string;
  type: string;
  name: string;
  status: string;
  data: Record<string, unknown>;
}

async function ensureConnected(): Promise<string | null> {
  const conn = await chrome.connect();
  if (!conn.connected) return conn.error ?? "Verbindung fehlgeschlagen";
  const loaded = await chrome.checkSpacesLoaded();
  if (!loaded.loaded) return loaded.error ?? "Spaces nicht geladen";
  return null;
}

function formatError(error: string) {
  return { content: [{ type: "text" as const, text: `Fehler: ${error}` }] };
}

async function getAllNodes(): Promise<NodeInfo[]> {
  const result = await chrome.evaluate<NodeInfo[]>(JS_SNIPPETS.GET_ALL_NODES);
  return result.value ?? [];
}

function findNodeByName(nodes: NodeInfo[], name: string): NodeInfo | undefined {
  return nodes.find(n => n.name.toLowerCase().includes(name.toLowerCase()));
}

async function setNodeText(nodeId: string, text: string): Promise<boolean> {
  const result = await chrome.evaluate<{ success: boolean }>(JS_SNIPPETS.SET_NODE_TEXT(nodeId, text));
  return result.value?.success ?? false;
}

async function runNode(nodeId: string): Promise<{ success: boolean; error?: string }> {
  const result = await chrome.evaluate<{ success: boolean; error?: string }>(JS_SNIPPETS.RUN_NODE(nodeId));
  return result.value ?? { success: false, error: "Keine Antwort" };
}

async function waitForNode(nodeId: string, timeoutMs: number): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await chrome.evaluate<{ status: string }>(JS_SNIPPETS.CHECK_NODE_STATUS(nodeId));
    const status = result.value?.status ?? "unknown";
    if (status !== "running" && status !== "pending" && status !== "queued") {
      return status;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  treturn "timeout";
}

async function getNodeOutput(nodeId: string): Promise<Record<string, unknown>> {
  const result = await chrome.evaluate<Record<string, unknown>>(JS_SNIPPETS.GET_NODE_OUTPUTnodeId));
  return result.value ?? {};
}

// ─── Tool-Registrierung ──────────────────────────────────────

export function registerWorkflowTools(server: McpServer): void {

  // ── freepik_run_print_pipeline ───────────────────────────

  server.registerTool(
    "freepik_run_print_pipeline",
    {
      title: "Print Automation Pipeline ausführen",
      description: `Führt die komplette Print Automation Pipeline aus.

Die Pipeline besteht aus zwei Pfaden:

Pfad A (Artwork):
  Bild-Beschreibung → Bild-Interpret → Artwork Generator → Print Upscaler

Pfad B (Raum):
  Raum-Beschreibung → Raum-Interpret → Raum Generator → Mockup Upscaler
  ++ Upscaled Artwork as Reference für den Raum-Generator)

Workflow:
1. Setzt die Bild-Beschreibung und Raum-Beschreibung in die Text-Nodes
2. Wen auto_run=true: Führt alle Nodes der Reihe nach aus und wartet auf Ergeb="nisse
Args:
  - bild_beschreibung Text für das gewünschte Kunstwerk
  - raum_beschreibung: Text für den Raum/Mockup
  - auto_run: Automatisch ausführen? (Standard: false)
  - step_timeout_ms: Timeout pro Schritt (Standard: 60000ms)
Returns: Status-Report mit allen Schritten und Ergeb
"issen.`,
      inputSchema: RunPipelineInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      const err = await ensureConnected();
      if (err) return formatError(err);

      const nodes = await getAllNodes();
      if (nodes.length === 0) return formatError("Keine Nodes im Space gefunden");

      // Nodes finden
      const bildRef = findNodeByName(nodes, "Bild-Beschreibung");
      const raumRef = findNodeByName(nodes, "Raum-Beschreibung");
      const bildInterpret = findNodeByName(nodes, "Bild-Interpret");
      const raumInterpret = findNodeByName(nodes, "Raum-Interpret");
      const artworkGen = findNodeByName(nodes, "Artwork Generator");
      const raumGen = findNodeByName(nodes, "Raum Generator");
      const printUpscaler = findNodeByName(nodes, "Print Upscaler");
      const mockupUpscaler = findNodeByName(nodes, "Mockup Upscaler");

      const steps: Array<{ step: string; status: string; details?: unknown }> = [];

      // Schritt 1: Texte setzen
      if (bildRef) {
        const ok = await setNodeText(bildRef.id, params.bild_beschreibung);
        steps.push({ step: "Bild-Beschreibung setzen", status: ok ? "ok" : "fehler" });
      } else {
        steps.push({ step: "Bild-Beschreibung setzen", status: "fehler", details: "Node nicht gefunden" });
      }

      if (raumRef) {
        const ok = await setNodeText(raumRef.id, params.raum_beschreibung);
        steps.push({ step: "Raum-Beschreibung setzen", status: ok ? "ok" : "fehler" });
      } else {
        steps.push({ step: "Raum-Beschreibung setzen", status: "fehler", details: "Node nicht gefunden" });
      }

      if (!params.auto_run) {
        steps.push({ step: "Auto-Run deaktiviert", status: "info", details: "Texte gesetzt. Nodes müssen manuell ausgeführt werden." });
        return {
          content: [{ type: "text", text: JSON.stringify({ pipeline: "print_automation", steps }, null, 2) }]
        };
      }

      // Schritt 2: Pfad A ausführen
      // Bild-Interpret
      if (bildInterpret) {
        const run = await runNode(bildInterpret.id);
        if (run.success) {
          const status = await waitForNode(bildInterpret.id, params.step_timeout_ms);
          steps.push({ step: "Bild-Interpret ausführen", status, details: await getNodeOutput(bildInterpret.id) });
        } else {
          steps.push({ step: "Bild-Interpret ausführen", status: "fehler", details: run.error });
        }
      }

      // Artwork Generator
      if (artworkGen) {
        const run = await runNode(artworkGen.id);
        if (run.success) {
          const status = await waitForNode(artworkGen.id, params.step_timeout_ms);
          steps.push({ step: "Artwork Generator ausführen", status, details: await getNodeOutput(artworkGen.id) });
        } else {
          steps.push({ step: "Artwork Generator ausführen", status: "fehler", details: run.error });
        }
      }

      // Print Upscaler
      if (printUpscaler) {
        const run = await runNode(printUpscaler.id);
        if (run.success) {
          const status = await waitForNode(printUpscaler.id, params.step_timeout_ms);
          steps.push({ step: "Print Upscaler ausführen", status, details: await getNodeOutput(printUpscaler.id) });
        } else {
          steps.push({ step: "Print Upscaler ausführen", status: "fehler", details: run.error });
        }
      }

      // Schritt 3: Pfad B ausführen (nach Pfad A, weil Artwork als Referenz dient)
      // Raum-Interpret
      if (raumInterpret) {
        const run = await runNode(raumInterpret.id);
        if (run.success) {
          const status = await waitForNode(raumInterpret.id, params.step_timeout_ms);
          steps.push({ step: "Raum-Interpret ausführen", status, details: await getNodeOutput(raumInterpret.id) });
        } else {
          steps.push({ step: "Raum-Interpret ausführen", status: "fehler", details: run.error });
        }
      }

      // Raum Generator
      if (raumGen) {
        const run = await runNode(raumGen.id);
        if (run.success) {
          const status = await waitForNode(raumGen.id, params.step_timeout_ms);
          steps.push({ step: "Raum Generator ausführen", status, details: await getNodeOutput(raumGen.id) });
        } else {
          steps.push({ step: "Raum Generator ausführen", status: "fehler", details: run.error });
        }
      }

      // Mockup Upscaler
      if (mockupUpscaler) {
        const run = await runNode(mockupUpscaler.id);
        if (run.success) {
          const status = await waitForNode(mockupUpscaler.id, params.step_timeout_ms);
          steps.push({ step: "Mockup Upscaler ausführen", status, details: await getNodeOutput(mockupUpscaler.id) });
        } else {
          steps.push({ step: "Mockup Upscaler ausführen", status: "fehler", details: run.error });
        }
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            pipeline: "print_automation",
            bild_beschreibung: params.bild_beschreibung,
            raum_beschreibung: params.raum_beschreibung,
            steps,
            total_steps: steps.length,
            successful: steps.filter(s => s.status === "ok" || s.status === "idle" || s.status === "completed").length,
          }, null, 2)
        }]
      };
    }
  (
