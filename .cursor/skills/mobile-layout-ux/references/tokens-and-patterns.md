# Tokens & patterns (companion)

## Suggested CSS variables (dark kitchen / Mijote-compatible)

```css
:root {
  --bg: #0f1115;
  --bg2: #171a21;
  --bg3: #1f242e;
  --surface: #1a1e26;
  --line: #2a303c;
  --txt: #e6e9ef;
  --txt2: #a6adbb;
  --txt3: #6b7280;
  --accent: #7ee0a8;
  --accent2: #4cc38a;
  --warn: #f2b25c;
  --danger: #e06c75;
  --rad: 14px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 40px;
  --space-7: 64px;
  --max-read: 40rem;   /* ~640px */
  --max-shell: 67.5rem; /* ~1080px */
  --nav-h: 64px;
  --tap: 44px;
  --font-body: 16px;
  --lh: 1.5;
}
```

## Golden-ratio type ladder (from 16px body)

| Step | px (approx) | use |
|------|-------------|-----|
| −2 | 10–11 | avoid for UI text |
| −1 | 13 | meta |
| 0 | 16 | body |
| +1 | 20 | h3 |
| +2 | 26 | h2 |
| +3 | 32 | display |
| +4 | 42 | marketing only |

Formula mental model: `size_n ≈ size_0 × φ^n` then snap to 2/4px grid.

## Bottom nav pattern

```
┌─────────────────────────────┐
│  sticky thin top (brand)    │
├─────────────────────────────┤
│                             │
│  scrollable main            │
│  padding-bottom: nav+safe   │
│                             │
├─────────────────────────────┤
│ ◎ ◎ ◎ ◎ ⋯  ← max 5 + more  │
└─────────────────────────────┘
```

- Active: accent color + light fill, not underline-only.  
- Labels ≤ 10–12 characters; icon + text.  
- Plus sheet: list rows ≥ 48px height.

## Recipe list density

Prefer:

```
Title                         meta
cuisine · time · badges
[optional match bar]
```

Over: multi-paragraph cards with stacked chrome.

## Week planner on mobile

Options (pick one, don't mix):

1. **Horizontal day scroller** — snap cards ~80% viewport width  
2. **Vertical accordion** — one day expanded  
3. **2-column day grid** only from `md` up  

Never 7 micro-columns on 360px.

## Modal confirm (replace system dialogs)

- Title short  
- Body 1–3 lines  
- Actions right-aligned or stacked full-width on mobile (primary full-width on top or bottom — pick one pattern and keep it)  
- Destructive = danger text/outline, never same as primary mint

## Motion tokens

| Token | ms | easing |
|-------|-----|--------|
| fade view | 180–220 | ease |
| sheet | 240–280 | cubic-bezier(0.2, 0.8, 0.2, 1) |
| press | 80–120 | ease-out |

## Quick audit script (mental)

1. Squint test: can you still see hierarchy?  
2. Thumb test: can primary tasks be done one-handed?  
3. Gray test: if accent removed, is structure still clear?  
4. Stranger test: first screen explains what to do in &lt; 3 seconds?
