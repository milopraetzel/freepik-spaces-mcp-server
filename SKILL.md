---
name: freepik-spaces-skill
description: |
  Steuert Freepik Pikaso Spaces direkt im Browser — Nodes lesen, bearbeiten, verbinden, ausführen und komplette Workflows automatisieren. Nutze diesen Skill wenn der User mit Freepik Spaces, Pikaso Spaces, Print Automation, Bild-Pipelines, oder Node-basierten Bild-Workflows arbeiten will. Auch verwenden wenn der User "Freepik", "Pikaso", "Spaces", "Node Pipeline", "Artwork generieren", "Mockup erstellen" oder ähnliches erwähnt — selbst wenn er nicht explizit nach einem Skill fragt.
---

# Freepik Spaces Skill

Dieser Skill ermöglicht es Claude, Freepik Pikaso Spaces direkt über den Browser zu steuern — ohne separaten MCP Server, ohne CDP Setup. Claude nutzt die eingebauten Chrome-Tools (`javascript_tool`, `navigate`, `read_page`) um mit der VueFlow-Oberfläche zu interagieren.

## Voraussetzung

Der User muss einen Freepik Spaces Tab im Browser geöffnet haben (`https://www.freepik.com/pikaso/spaces/...`). Prüfe das zuerst über `tabs_context_mcp`.

## Architektur von Freepik Spaces

Freepik Spaces basiert auf **VueFlow** (Vue.js Flow-Editor) mit **Liveblocks** als Persistenz-Layer. Alle Daten sind über ein globales Debug-Objekt zugänglich:

```
window.__SPACES_PIKASO_DEBUG__.vueflow
```

Darüber erreichst du:
- `vueflow.nodes` — alle Nodes im Space (als Vue Reactive Array)
- `vueflow.edges` — alle Verbindungen zwischen Nodes

Für Operationen die **persistieren** müssen (löschen), nutze den VueFlow Flow Store:
```
document.getElementById('app').__vue_app__.config.globalProperties.$vueFlowStorage
```

### Was persistiert und was nicht

Das ist entscheidend für zuverlässige Automatisierung:

**Persistiert (über Liveblocks gespeichert):**
- `removeNodes()` und `removeEdges()` über den Flow Store
- Physische Drag-and-Drop Verbindungen im Browser
- Node-Daten-Änderungen über `boardElement.data`

**Persistiert NICHT (nur lokal):**
- `addEdges()` — bleibt nur in VueFlow, nicht in Liveblocks
- `hooks.connect.trigger()` und `hooks.edgesChange.trigger()`
- Direkte WebSocket-Operationen

Das bedeutet: Nodes **verbinden** geht nur zuverlässig über die UI (Drag-and-Drop simulieren oder den User bitten). Nodes **lesen, bearbeiten, ausführen und löschen** geht programmatisch.

## Node-Typen

Es gibt vier Node-Typen in Freepik Spaces. Lies `references/node-types.md` für die vollständige Handle-Kompatibilitätsmatrix.

| Typ | Beschreibung | Source-Handle | Target-Handles |
|-----|-------------|---------------|----------------|
| `text` | Text-Node (Beschreibungen) | `text` (Text) | keine |
| `prompt-generator` | Interpreter/Prompt-Generator | `generated_prompt` (Text) | `prompt`, `attachments` |
| `image-generator` | Bildgenerierung | `output` (Bild) | `prompt`, `reference` |
| `image-upscaler` | Bild-Upscaling | `output` (Bild) | `input-image` |

### Handle-Kompatibilität (Kurzfassung)

- `text` Output → NUR `prompt` Target
- `generated_prompt` Output → NUR `prompt` Target
- `output` (Bild) Output → `prompt`, `reference`, `input-image`, `attachments`
- **BLOCKIERT:** `text` → `attachments` oder `reference` (Text ist kein Bild)

## Arbeitsablauf

### Schritt 1: Tab finden und prüfen

Nutze `tabs_context_mcp` um den Freepik Spaces Tab zu identifizieren. Dann prüfe ob Spaces geladen ist:

```javascript
// Via javascript_tool ausführen
(function() {
  const debug = window.__SPACES_PIKASO_DEBUG__;
  if (!debug || !debug.vueflow) return { loaded: false, error: 'Spaces not loaded' };
  return { loaded: true };
})()
```

### Schritt 2: Nodes auslesen

Alle JavaScript-Snippets findest du in `references/js-snippets.md`. Die wichtigsten Operationen:

**Alle Nodes auflisten:**
```javascript
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
```

### Schritt 3: Nodes bearbeiten

Text, Instructions oder Prompts setzen — jeweils über `boardElement.data`:

```javascript
// Text setzen (für text-Nodes)
(function() {
  const vf = window.__SPACES_PIKASO_DEBUG__.vueflow;
  const nodes = vf.nodes?.value || vf.nodes || [];
  const n = nodes.find(n => n.id === 'NODE_ID_HIER');
  if (!n) return { success: false, error: 'Node not found' };
  n.data.boardElement.data.text = "Dein neuer Text";
  n.data.boardElement.updatedAt = new Date().toISOString();
  return { success: true };
})()
```

Ersetze je nach Node-Typ `.text` durch `.instructions` (prompt-generator) oder `.prompt` (image-generator).

### Schritt 4: Nodes ausführen

Finde den Generate/Run/Upscale Button im DOM und klicke ihn:

```javascript
(function() {
  const nodeEl = document.querySelector('[data-id="NODE_ID_HIER"]');
  if (!nodeEl) return { success: false, error: 'Node not in DOM' };
  const buttons = nodeEl.querySelectorAll('button');
  let runBtn = null;
  for (const btn of buttons) {
    const text = btn.textContent?.toLowerCase() || '';
    if (text.includes('generate') || text.includes('run') || text.includes('upscale')) {
      runBtn = btn;
      break;
    }
  }
  if (!runBtn) runBtn = nodeEl.querySelector('button[aria-label*="run"], button[aria-label*="play"], button[aria-label*="generate"]');
  if (!runBtn) return { success: false, error: 'Run button not found' };
  if (runBtn.disabled) return { success: false, error: 'Button disabled (missing input?)' };
  runBtn.click();
  return { success: true, action: 'clicked_run_button' };
})()
```

### Schritt 5: Auf Ergebnis warten

Nach dem Ausführen muss gepollt werden bis der Node fertig ist:

```javascript
(function() {
  const vf = window.__SPACES_PIKASO_DEBUG__.vueflow;
  const nodes = vf.nodes?.value || vf.nodes || [];
  const n = nodes.find(n => n.id === 'NODE_ID_HIER');
  if (!n) return { status: 'not_found' };
  return {
    nodeId: n.id,
    status: n.data?.boardElement?.workflowState?.status || 'unknown',
  };
})()
```

Führe diesen Snippet alle 2-3 Sekunden aus bis `status` nicht mehr `running`, `pending` oder `queued` ist. Dann den Output abrufen — siehe `references/js-snippets.md` für GET_NODE_OUTPUT.

### Schritt 6: Nodes löschen (persistiert)

Für Löschungen nutze den Flow Store, nicht VueFlow direkt:

```javascript
(function() {
  const appEl = document.getElementById('app') || document.querySelector('[data-v-app]');
  if (!appEl?.__vue_app__) return { success: false, error: 'Vue app not found' };
  const vfs = appEl.__vue_app__.config.globalProperties.$vueFlowStorage;
  const flowId = [...vfs.flows.keys()][0];
  const fs = vfs.flows.get(flowId);
  fs.removeNodes(['NODE_ID_HIER']);
  return { success: true, persisted: true };
})()
```

Für Edges: `fs.removeEdges(['EDGE_ID_HIER'])`.

## Print Automation Pipeline

Die typische Pipeline in Freepik Spaces hat zwei Pfade:

**Pfad A — Artwork:**
```
Bild-Beschreibung (text) → Bild-Interpret (prompt-generator) → Artwork Generator (image-generator) → Print Upscaler (image-upscaler)
```

**Pfad B — Raum-Mockup:**
```
Raum-Beschreibung (text) → Raum-Interpret (prompt-generator) → Raum Generator (image-generator) → Mockup Upscaler (image-upscaler)
```

Pfad B hängt von Pfad A ab, weil das upscaled Artwork als Referenzbild in den Raum Generator fließt. Führe daher immer Pfad A zuerst aus.

### Pipeline automatisch ausführen

1. Alle Nodes auflisten und nach Name identifizieren (z.B. "Bild-Beschreibung", "Bild-Interpret", etc.)
2. Texte in die Text-Nodes schreiben
3. Nodes der Reihe nach ausführen: Interpret → Generator → Upscaler
4. Nach jedem Schritt auf Fertigstellung warten (polling)
5. Am Ende den Output (Bild-URLs) abrufen

Für die vollständigen Snippets aller Operationen: lies `references/js-snippets.md`.

## Tipps und Fehlervermeidung

- Prüfe immer zuerst ob `window.__SPACES_PIKASO_DEBUG__` existiert
- Nodes müssen im sichtbaren DOM-Bereich sein damit der Run-Button gefunden wird — ggf. muss der User scrollen
- Der Run-Button kann `disabled` sein wenn Inputs fehlen (z.B. keine Verbindung zum vorherigen Node)
- Texte über 25.000 Zeichen werden von Freepik abgeschnitten
- Node-Größen: Text (420x200), Prompt-Generator (420x350), Image-Generator (420x500), Upscaler (420x300)
