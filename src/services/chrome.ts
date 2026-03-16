/**
 * Chrome DevTools Protocol (CDP) Service
 *
 * Verbindet sich mit einem laufenden Chrome-Browser über CDP
 * und führt JavaScript im Kontext der Freepik Spaces Seite aus.
 *
 * Voraussetzung: Chrome muss mit --remote-debugging-port=9222 gestartet werden.
 */

import CDP from "chrome-remote-interface";

interface CDPTarget {
  id: string;
  title: string;
  url: string;
  type: string;
  webSocketDebuggerUrl?: string;
}

interface EvalResult<T = unknown> {
  success: boolean;
  value?: T;
  error?: string;
}

export class ChromeService {
  private client: CDP.Client | null = null;
  private targetId: string | null = null;
  private port: number;
  private host: string;

  constructor(port = 9222, host = "127.0.0.1") {
    this.port = port;
    this.host = host;
  }

  /**
   * Findet den Freepik Spaces Tab im Browser.
   */
  async findSpacesTab(): Promise<CDPTarget | null> {
    try {
      const targets = await CDP.List({ port: this.port, host: this.host }) as CDPTarget[];
      return targets.find(t =>
        t.type === "page" && t.url.includes("freepik.com/pikaso/spaces")
      ) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Verbindet sich mit dem Freepik Spaces Tab.
   * Falls bereits verbunden, wird die bestehende Verbindung wiederverwendet.
   */
  async connect(): Promise<{ connected: boolean; url?: string; error?: string }> {
    // Bereits verbunden?
    if (this.client && this.targetId) {
      try {
        // Teste ob die Verbindung noch lebt
        await this.client.Runtime.evaluate({ expression: "1+1" });
        return { connected: true };
      } catch {
        // Verbindung tot — neu verbinden
        this.client = null;
        this.targetId = null;
      }
    }

    const tab = await this.findSpacesTab();
    if (!tab) {
      return {
        connected: false,
        error: `Kein Freepik Spaces Tab gefunden. Bitte öffne https://www.freepik.com/pikaso/spaces/... in Chrome (gestartet mit --remote-debugging-port=${this.port}).`
      };
    }

    try {
      this.client = await CDP({ target: tab.id, port: this.port, host: this.host });
      this.targetId = tab.id;
      await this.client.Runtime.enable();
      return { connected: true, url: tab.url };
    } catch (err) {
      return {
        connected: false,
        error: `CDP-Verbindung fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }

  /**
   * Führt JavaScript im Freepik Spaces Tab aus und gibt das Ergebnis zurück.
   */
  async evaluate<T = unknown>(expression: string): Promise<EvalResult<T>> {
    if (!this.client) {
      const conn = await this.connect();
      if (!conn.connected) {
        return { success: false, error: conn.error };
      }
    }

    try {
      const result = await this.client!.Runtime.evaluate({
        expression,
        returnByValue: true,
        awaitPromise: true,
      });

      if (result.exceptionDetails) {
        const errText = result.exceptionDetails.exception?.description
          || result.exceptionDetails.text
          || "Unknown JS error";
        return { success: false, error: errText };
      }

      return {
        success: true,
        value: result.result.value as T,
      };
    } catch (err) {
      // Verbindung verloren — reset
      this.client = null;
      this.targetId = null;
      return {
        success: false,
        error: `CDP evaluation failed: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }

  /**
   * Prüft ob Freepik Spaces vollständig geladen ist.
   */
  async checkSpacesLoaded(): Promise<{ loaded: boolean; error?: string }> {
    const result = await this.evaluate<{ loaded: boolean; error?: string }>(`
      (function() {
        const debug = window.__SPACES_PIKASO_DEBUG__;
        if (!debug || !debug.vueflow) return { loaded: false, error: 'Spaces not loaded or debug object missing' };
        return { loaded: true };
      })()
    `);

    if (!result.success) return { loaded: false, error: result.error };
    return result.value ?? { loaded: false, error: "No result" };
  }

  /**
   * Trennt die CDP-Verbindung.
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        // Ignorieren
      }
      this.client = null;
      this.targetId = null;
    }
  }

  /**
   * Gibt den Verbindungsstatus zurück.
   */
  isConnected(): boolean {
    return this.client !== null;
  }
}

// Singleton-Instanz
export const chrome = new ChromeService(
  parseInt(process.env.CDP_PORT || "9222"),
  process.env.CDP_HOST || "127.0.0.1"
);
