# Mijote

Static meal-planning webapp (single `index.html`). No build step, no package manager, no external runtime dependencies.

## Cursor Cloud specific instructions

- **Preview:** A static server runs on port **8080** (see `.cursor/environment.json` `terminals`).
- **Open:** http://localhost:8080/ — root serves `index.html`.
- **Verify changes:** Reload the browser after editing HTML/CSS/JS; there is no compile step.
- **No npm:** Do not run `npm install` unless a toolchain is intentionally added later.
- **Data:** The app uses browser `localStorage` only; nothing is sent to a server.
