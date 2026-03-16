/**
 * Freepik Spaces — Konstanten & Typ-Kompatibilitätsmatrix
 *
 * Alle Erkenntnisse aus der Browser-Analyse (März 2026):
 * - VueFlow + Liveblocks als Persistenz-Layer
 * - Handle-Typ-Kompatibilität wird von Freepik erzwungen
 * - Nur bestimmte VueFlow-Operationen persistieren zu Liveblocks
 */

// ─── Handle-Kompatibilität ───────────────────────────────────

export interface HandleInfo {
  id: string;
  direction: "source" | "target";
  type: "text" | "image" | "any";
  description: string;
}

export interface NodeTypeInfo {
  type: string;
  label: string;
  sourceHandles: HandleInfo[];
  targetHandles: HandleInfo[];
}

/**
 * Vollständige Handle-Kompatibilitätsmatrix.
 *
 * Regeln:
 *   text output      → NUR prompt target (Text→Text)
 *   generated_prompt  → NUR prompt target (Text→Text)
 *   output (image)   → prompt, reference, input-image, attachments (Bild→alles)
 *
 * BLOCKIERT:
 *   text → attachments  (Text ≠ Media)
 *   text → reference    (Text ≠ Image)
 */
export const HANDLE_COMPATIBILITY: Record<string, string[]> = {
  // Source handle → erlaubte Target handles
  "text":             ["prompt"],
  "generated_prompt": ["prompt"],
  "output":           ["prompt", "reference", "input-image", "attachments"],
};

export const NODE_TYPES: Record<string, NodeTypeInfo> = {
  "text": {
    type: "text",
    label: "Text-Node",
    sourceHandles: [
      { id: "text", direction: "source", type: "text", description: "Text-Output — verbindbar NUR mit 'prompt'" }
    ],
    targetHandles: [],
  },
  "prompt-generator": {
    type: "prompt-generator",
    label: "Prompt-Generator (Interpreter)",
    sourceHandles: [
      { id: "generated_prompt", direction: "source", type: "text", description: "Generierter Prompt — verbindbar NUR mit 'prompt'" }
    ],
    targetHandles: [
      { id: "prompt", direction: "target", type: "text", description: "Text-Eingang (akzeptiert Text + Bilder)" },
      { id: "attachments", direction: "target", type: "image", description: "Medien-Eingang (akzeptiert NUR Bilder)" },
    ],
  },
  "image-generator": {
    type: "image-generator",
    label: "Bild-Generator",
    sourceHandles: [
      { id: "output", direction: "source", type: "image", description: "Bild-Output — verbindbar mit allem" }
    ],
    targetHandles: [
      { id: "prompt", direction: "target", type: "text", description: "Prompt-Eingang" },
      { id: "reference", direction: "target", type: "image", description: "Referenzbild (akzeptiert NUR Bilder)" },
    ],
  },
  "image-upscaler": {
    type: "image-upscaler",
    label: "Bild-Upscaler",
    sourceHandles: [
      { id: "output", direction: "source", type: "image", description: "Upscaled Bild-Output" }
    ],
    targetHandles: [
      { id: "input-image", direction: "target", type: "image", description: "Bild-Eingang (akzeptiert NUR Bilder)" },
    ],
  },
};

// ─── Persistenz-Verhalten ────────────────────────────────────

/**
 * VueFlow-Operationen und ihre Persistenz zu Liveblocks:
 *
 * ✅ PERSISTIERT:
 *   - removeEdges() via Flow Store ($vueFlowStorage)
 *   - removeNodes() via Flow Store ($vueFlowStorage)
 *   - Physische Drag-and-Drop Verbindungen im Browser
 *   - Node-Daten-Änderungen via Liveblocks Storage
 *
 * ❌ PERSISTIERT NICHT:
 *   - addEdges() (nur lokal in VueFlow)
 *   - hooks.connect.trigger()
 *   - hooks.edgesChange.trigger()
 *   - Direkte WebSocket-Operationen (Auth-Probleme)
 */

// ─── Node-Defaults ────────────────────────────────────────────

export const NODE_SIZES: Record<string, [number, number]> = {
  "text":             [420, 200],
  "prompt-generator": [420, 350],
  "image-generator":  [420, 500],
  "image-upscaler":   [420, 300],
};

export const CHARACTER_LIMIT = 25000;

// ─── VueFlow JS Snippets ─────────────────────────────────────

/**
 * JavaScript-Snippets die im Browser ausgeführt werden.
 * Zugriff auf VueFlow über zwei Wege:
 *   1. Debug-Objekt: window.__SPACES_PIKASO_DEBUG__.vueflow
 *   2. Flow Store:   Vue app → $vueFlowStorage → flows Map → flow store
 */
export const JS_SNIPPETS = {
  /** Prüft ob Freepik Spaces geladen ist */
  CHECK_SPACES_LOADED: `
    (function() {
      const debug = window.__SPACES_PIKASO_DEBUG__;
      if (!debug || !debug.vueflow) return { loaded: false, error: 'Spaces not loaded' };
      return { loaded: true };
    })()
  `,

  /** Holt alle Nodes mit ihren Daten */
  GET_ALL_NODES: `
    (function() {
      const vf = window.__SPACES_PIKASO_DEBUG__.vueflow;
      const nodes = vf.nodes?.value || vf.nodes || [];
      return nodes.map(n => ({
        id: n.id,
        type: n.data?.boardElement?.type || n.type,
        name: n.data?.boardElement?.name || 'Unnamed',
        position: n.position,
        status: n.data?.boardElement?.workflowState?.status || 'unknown',
        data: {
          text: n.data?.boardElement?.data?.text,
          prompt: n.data?.boardElement?.data?.prompt,
          instructions: n.data?.boardElement?.data?.instructions,
          output: n.data?.boardElement?.data?.output,
          aspectRatio: n.data?.boardElement?.data?.aspectRatio,
          model: n.data?.boardElement?.data?.model,
          factor: n.data?.boardElement?.data?.factor,
        }
      }));
    })()
  `,

  /** Holt alle Edges */
  GET_ALL_EDGES: `
    (function() {
      const vf = window.__SPACES_PIKASO_DEBUG__.vueflow;
      const edges = vf.edges?.value || vf.edges || [];
      return edges.map(e => ({
        id: e.id,
        source: e.source,
        sourceHandle: e.sourceHandle,
        target: e.target,
        targetHandle: e.targetHandle,
      }));
    })()
  `,

  /** Holt einen einzelnen Node */
  GET_NODE: (nodeId: string) => `
    (function() {
      const vf = window.__SPACES_PIKASO_DEBUG__.vueflow;
      const nodes = vf.nodes?.value || vf.nodes || [];
      const n = nodes.find(n => n.id === '${nodeId}');
      if (!n) return null;
      return {
        id: n.id,
        type: n.data?.boardElement?.type || n.type,
        name: n.data?.boardElement?.name || 'Unnamed',
        position: n.position,
        status: n.data?.boardElement?.workflowState?.status || 'unknown',
        data: n.data?.boardElement?.data || {},
      };
    })()
  `,

  /** Setzt Text in einem Text-Node */
  SET_NODE_TEXT: (nodeId: string, text: string) => `
    (function() {
      const vf = window.__SPACES_PIKASO_DEBUG__.vueflow;
      const nodes = vf.nodes?.value || vf.nodes || [];
      const n = nodes.find(n => n.id === '${nodeId}');
      if (!n) return { success: false, error: 'Node not found' };
      if (!n.data?.boardElement?.data) return { success: false, error: 'Node has no data' };
      n.data.boardElement.data.text = ${JSON.stringify(text)};
      n.data.boardElement.updatedAt = new Date().toISOString();
      return { success: true, nodeId: '${nodeId}' };
    })()
  `,

  /** Setzt Instructions in einem Prompt-Generator Node */
  SET_NODE_INSTRUCTIONS: (nodeId: string, instructions: string) => `
    (function() {
      const vf = window.__SPACES_PIKASO_DEBUG__.vueflow;
      const nodes = vf.nodes?.value || vf.nodes || [];
      const n = nodes.find(n => n.id === '${nodeId}');
      if (!n) return { success: false, error: 'Node not found' };
      if (!n.data?.boardElement?.data) return { success: false, error: 'Node has no data' };
      n.data.boardElement.data.instructions = ${JSON.stringify(instructions)};
      n.data.boardElement.updatedAt = new Date().toISOString();
      return { success: true, nodeId: '${nodeId}' };
    })()
  `,

  /** Setzt den Prompt in einem Image-Generator Node */
  SET_NODE_PROMPT: (nodeId: string, prompt: string) => `
    (function() {
      const vf = window.__SPACES_PIKASO_DEBUG__.vueflow;
      const nodes = vf.nodes?.value || vf.nodes || [];
      const n = nodes.find(n => n.id === '${nodeId}');
      if (!n) return { success: false, error: 'Node not found' };
      if (!n.data?.boardElement?.data) return { success: false, error: 'Node has no data' };
      n.data.boardElement.data.prompt = ${JSON.stringify(prompt)};
      n.data.boardElement.updatedAt = new Date().toISOString();
      return { success: true, nodeId: '${nodeId}' };
    })()
  `,

  /** Löscht einen Node via Flow Store (persistiert zu Liveblocks) */
  DEPETEE_NODE: (nodeId: string) => `
    (function() {
      const appEl = document.getElementById('app') || document.querySelector('[data-v-app]');
      if (!appEl?.__vue_app__) return { success: false, error: 'Vue app not found' };
      const vfs = appEl.__vue_app__.config.globalProperties.$vueFlowStorage;
      const flowId = [...vfs.flows.keys()][0];
      const fs = vfs.flows.get(flowId);
      fs.removeNodes(['${nodeId}']);
      return { success: true, persisted: true };
    })()
  `,

  /** Lösch eine Edge via Flow Store (persistiert zu Liveblocks) */
  DEPETEE_EDGE: (edgeId: string) => `
    (function() {
      const appEl = document.getElementById('app') || document.querySelector('[data-v-app]');
      if (!appEl?.__vue_app__) return { success: false, error: 'Vue app not found' };
      const vfs = appEl.__vue_app__.config.globalProperties.$vueFlowStorage;
      const flowId = [...vfs.flows.keys()][0];
      const fs = vfs.flows.get(flowId);
      fs.removeEdges(['${edgeId}']);
      return { success: true, persisted: true };
    })()
  `,

  /** Findet den Run-Button eines Nodes und klickt ihn */
  RUN_NODE: (nodeId: string) => `
    (function() {
      // Finde den Node im DOM
      const nodeEl = document.querySelector('[data-id="${nodeId}"]');
      if (!nodeEl) return { success: false, error: 'Node element not found in DOM' };

      // Suche den Run/Generate Button
      const buttons = nodeEl.querySelectorAll('button');
      let runBtn = null;
      for (const btn of buttons) {
        const text = btn.textContent?.toLowerCase() || '';
        if (text.includes('generate') || text.includes('run') || text.includes('upscale')) {
          runBtn = btn;
          break;
        }
      }

      // Fallback: Play-Icon Button
      if (!runBtn) {
        runBtn = nodeEl.querySelector('button[aria-label*="run"], button[aria-label*="play"], button[sria-label*="generate"]');
      }

      if (!runBtn) return { success: false, error: 'Run button not found on node' };
      if (runBtn.disabled) return { success: false, error: 'Run button is disabled (missing input?)' };

      runBtn.click();
      return { success: true, nodeId: '${nodeId}', action: 'clicked_run_button' };
    })()
  `,

  /** Holt den Output eines Nodes (Bild-URL oder generierten Text) */
  GET_NODE_OUTPUT8o (nodeId: string) => `
    (function() {
      const vf = window.__SPACES_PIKASO_DEBUG__.vueflow;
      const nodes = vf.nodes?.value || vf.nodes || [];
      const n = nodes.find(n => n.id === '${nodeId}');
      if (!n) return { error: 'Node not found' };

      const data = n.data?.boardElement?.data || {};
      const state = n.data?.boardElement?.workflowState || {};

      return {
        nodeId: '${nodeId}',
        name: n.data?.boardElement?.name,
        type: n.data?.boardElement?.type,
        status: state.status || 'unknown',
        output: data.output || null,
        generatedPrompt: data.generatedPrompt || data.generated_prompt || null,
        imageUrl: data.imageUrl || data.image_url || data.result?.url || null,
        results: data.results || null,
      };
    })()
  `,

  /** Wartet bis ein Node fertig ist (polling-fähig) */
  CHECK_NODE_STATUS: (nodeId: string) => `
    (function() {
      const vf = window.__SPACES_PIKASO_DEBUG__.vueflow;
      const nodes = vf.nodes?.value || vf.nodes || [];
      const n = nodes.find(n => n.id === '${nodeId}');
      if (!n) return { status: 'not_found' };
      return {
        nodeId: '${nodeId}',
        status: n.data?.boardElement?.workflowState?.status || 'unknown',
      };
    })()
  `,
};
