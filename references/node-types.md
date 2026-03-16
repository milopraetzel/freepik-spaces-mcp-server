# Node-Typen & Handle-Kompatibilität

## Node-Typen im Detail

### text (Text-Node)
- **Zweck:** Statischer Text-Input (z.B. Bild-Beschreibung, Raum-Beschreibung)
- **Größe:** 420 x 200 px
- **Source-Handles:**
  - `text` (Typ: text) — verbindbar NUR mit `prompt` Target-Handles
  - **Target-Handles:** keine
  - **Datenfeld:** `boardElement.data.text`

  ### prompt-generator (Interpreter)
  - **Zweck:** Nimmt Text-Input und generiert daraus einen optimierten Prompt
  - **Größe:** 420 x 350 px
  - **Source-Handles:**
    - `generated_prompt` (Typ: text) — verbindbar NUR mit `prompt` Target-Handles
    - **Target-Handles:**
      - `prompt` (Typ: text) — akzeptiert Text und Bilder
        - `attachments` (Typ: image) — akzeptiert NUR Bilder
        - **Datenfeld:** `boardElement.data.instructions`

        ### image-generator (Bild-Generator)
        - **Zweck:** Generiert Bilder aus Prompts, optional mit Referenzbild
        - **Größe:** 420 x 500 px
        - **Source-Handles:**
          - `output` (Typ: image) — verbindbar mit allen Target-Handles
          - **Target-Handles:**
            - `prompt` (Typ: text) — Prompt-Eingang
              - `reference` (Typ: image) — Referenzbild (akzeptiert NUR Bilder)
              - **Datenfelder:** `boardElement.data.prompt`, `boardElement.data.aspectRatio`, `boardElement.data.model`

              ### image-upscaler (Bild-Upscaler)
              - **Zweck:** Skaliert Bilder auf höhere Auflösung
              - **Größe:** 420 x 300 px
              - **Source-Handles:**
                - `output` (Typ: image) — verbindbar mit allen Target-Handles
                - **Target-Handles:**
                  - `input-image` (Typ: image) — akzeptiert NUR Bilder
                  - **Datenfeld:** `boardElement.data.factor`

                  ## Handle-Kompatibilitätsmatrix

                  | Source-Handle | Erlaubte Target-Handles |
                  |---|---|
                  | `text` | `prompt` |
                  | `generated_prompt` | `prompt` |
                  | `output` (Bild) | `prompt`, `reference`, `input-image`, `attachments` |

                  ## Blockierte Verbindungen

                  Diese Verbindungen werden von Freepik abgelehnt:

                  - `text` → `attachments` (Text ist kein Media-Format)
                  - `text` → `reference` (Text ist kein Bild)
                  - `text` → `input-image` (Text ist kein Bild)
                  - `generated_prompt` → `attachments` (Text ist kein Media-Format)
                  - `generated_prompt` → `reference` (Text ist kein Bild)
                  - `generated_prompt` → `input-image` (Text ist kein Bild)

                  ## Typische Pipeline-Kette

                  ```
                  text → prompt-generator → image-generator → image-upscaler
                         (text→prompt)      (gen_prompt→prompt)  (output→input-image)
                         ```

                         Jede Verbindung in dieser Kette ist kompatibel:
                         1. `text`.text → `prompt-generator`.prompt (Text→Text)
                         2. `prompt-generator`.generated_prompt → `image-generator`.prompt (Text→Text)
                         3. `image-generator`.output → `image-upscaler`.input-image (Bild→Bild)
