---
name: mobile-layout-ux
description: >-
  Mobile-first layout, responsive UI, readability, and Behance-level visual
  craft for web and WebView/APK apps. Use when improving UI/UX, typography,
  spacing, navigation, dark themes, or redesigning pages for phones. Applies
  golden-ratio rhythm, touch targets, and anti-slop design rules before coding.
---

# Mobile Layout & UX/UI Craft

Read this skill **before** changing layout, CSS, or navigation. Plan the visual system first; then implement.

## Goal

Ship interfaces that are **easy to read on a phone**, pleasant at a glance (Behance-quality composition), and usable with thumbs — without looking like generic AI UI.

## Hard anti-slop rules (do not ship)

Avoid default AI-design clusters:

1. Purple-on-white / purple→indigo gradient themes  
2. Warm cream `#F4F1EA` + high-contrast serif + terracotta accent  
3. Broadsheet layout: hairline rules, zero radius, dense newspaper columns  
4. Default stacks only (Inter / Roboto / Arial / system) when expressive type is allowed  
5. Glow soup, rounded-full pill clusters, multi-layer shadows, emoji as decoration noise  

Also avoid: dashboard clutter in non-dashboard screens; inset hero cards; floating badge stickers on media; stats strips in the first viewport unless the product *is* a dashboard.

## Process (mandatory order)

1. **Audit** — current hierarchy, density, contrast, tap targets, scroll friction  
2. **Define tokens** — type scale, spacing scale (φ-based), colors, radii, elevation  
3. **Compose** — mobile wire in mind (one job per section)  
4. **Implement** — CSS/HTML only where needed; keep behavior intact  
5. **Self-check** — run the checklist at the end of this skill  

---

## 1. Mobile-first composition

### Thumb & reach

- Primary actions live in the **lower two-thirds** or sticky bottom bars.  
- Destructive / rare actions can sit higher or behind overflow.  
- Bottom nav: **3–5** primary items max; overflow extras in **Plus / More**.  
- Account for `env(safe-area-inset-*)` (notch, home indicator, status bar).

### Touch targets

| Element | Minimum |
|---------|---------|
| Tap target | **44×44 px** (prefer 48) |
| Gap between targets | ≥ **8 px** |
| List row height | ≥ **48–56 px** |
| Form inputs | height ≥ **44 px**, font ≥ **16 px** (prevents iOS zoom) |

### One job per section

Each block = **one purpose**, one headline, one short support line.  
If removing a border/shadow/background does not hurt understanding → remove it (no decorative cards).

### First viewport budget

Usually only: brand/title signal, one headline, one short sentence, one CTA group, one dominant visual if any.  
No packed metadata, schedules, or promo chips in the hero unless product-critical.

---

## 2. Golden ratio & spatial rhythm

Use **φ ≈ 1.618** to relate sizes — not as dogma, as a rhythm.

### Spacing scale (base 8, φ-flavored)

Prefer a small set of steps:

`4 · 8 · 12 · 16 · 24 · 40 · 64 · 104`

- Related gaps: step up/down one or two levels only.  
- Section padding mobile: **16–20** horizontal, **24–40** vertical between sections.  
- Max content width desktop: **~680–720px** for reading; app shells **~960–1080px**.  
- Split layouts: content ≈ **61.8%** / aside ≈ **38.2%** when two columns exist.

### Vertical rhythm

- Line-height body **1.45–1.6**.  
- Heading → body gap ≈ **0.35–0.5×** heading size.  
- Stack siblings with consistent gap token (e.g. always `12` or `16` inside a card-like group).

### Optical balance

- Align to a simple column grid (4 mobile / 12 desktop).  
- Prefer **asymmetric calm** over centered everything.  
- Leave negative space; density is earned by content priority, not fear of empty.

---

## 3. Typography (readability first)

### Scale (mobile)

| Role | Size | Weight |
|------|------|--------|
| Display / brand | 28–34 | 650–750 |
| Screen title (h2) | 22–26 | 650 |
| Section (h3) | 17–19 | 600 |
| Body | **16–17** | 400–450 |
| Secondary | 13–14 | 400 |
| Caption / meta | 12–13 | 500 |

- Keep **≤ 3** type roles visible at once in a block.  
- Measure (line length): **45–75 characters** on phone; avoid full-bleed 100vw paragraphs.  
- Prefer slightly looser tracking on caps/labels; tighter on large display.  
- Dark UI: body text **≠ pure `#fff`** on `#000` — use off-white on deep charcoal for comfort.

### Contrast (WCAG-minded)

- Body text ≥ **4.5:1** against background.  
- Muted text still ≥ **3:1** if it's meaningful (not purely decorative).  
- Don't rely on color alone for state (pair with icon, weight, or label).

---

## 4. Color & atmosphere

- Define CSS variables: bg layers, text tiers, accent, warn, danger, line.  
- **One** accent family; use warn/danger sparingly.  
- Backgrounds: subtle depth (soft gradient, faint grain, layered surfaces) — not flat void, not neon glow.  
- Separators: low-contrast lines or spacing alone; avoid heavy boxes everywhere.  
- Interactive accent must meet contrast on its label (e.g. dark text on mint button).

For Mijote-like food/planning apps: keep the existing dark kitchen mood (charcoal + fresh green) unless a full rebrand is requested — **refine, don't randomize**.

---

## 5. Responsive breakpoints

Mobile-first CSS.

| Token | Width | Intent |
|-------|-------|--------|
| default | 0+ | Phone single column, bottom nav |
| `sm` | ≥ 480 | Comfortable phone landscape / large phone |
| `md` | ≥ 768 | Tablet; optional top tabs; 2-col grids |
| `lg` | ≥ 1024 | Desktop shell, wider grids |

Rules:

- **One column** by default for forms, recipes, settings.  
- Grids: `auto-fill` with **min 280–300px** tracks; never squash below readable.  
- Week planners: scroll horizontally **or** stack days — don't force 7 cramped columns on 360px.  
- Hide/simplify chrome on small screens; don't shrink text below 12px to “fit”.  
- Test at **360 × 640**, **390 × 844**, **768 × 1024**.

---

## 6. Navigation & information architecture

- Persistent nav shows **where I am** (active state with color + weight, not color alone).  
- Depth: prefer sheets/modals for short tasks; full views for primary destinations.  
- Back behavior (APK/WebView): close overlay → leave secondary view → home → exit.  
- Sticky headers must be **thin**; content must not hide under bottom nav (padding-bottom ≥ nav height + safe area).  
- Toasts sit **above** bottom nav.

---

## 7. Components (ergonomic patterns)

### Lists & cards

- Default: **no cards**. Use cards only when they group an interaction or a discrete object (recipe, jar).  
- Card padding ≥ **14–16**; radius **12–16** (consistent).  
- Recipe rows: title prominent; meta secondary; match bar or badges not louder than title.

### Forms

- Labels above fields (not only placeholder).  
- One primary button per form region; secondary as ghost/outline.  
- Errors inline under the field; don't rely on `alert()`.

### Modals / sheets

- Mobile: bottom sheet or near-full-height modal with clear close.  
- Max width desktop ~520; gutters ≥ 16.  
- Focus primary action; destructive styled distinctly.

### Chips / filters

- Horizontal scroll > wrap chaos when many filters.  
- Chip height ≥ 36; text ≥ 13.

---

## 8. Behance-level graphic craft (practical)

Borrow from strong product shots on Behance — not trends for their own sake:

1. **Clear focal point** — eye hits brand or primary task first.  
2. **Intentional type pairing** — display character + neutral body (if adding fonts).  
3. **Surface hierarchy** — 2–3 elevation levels max.  
4. **Accent as punctuation** — not wallpaper.  
5. **Motion with purpose** — 2–3 gestures: view fade, sheet rise, button press; 150–280ms ease; no bounce spam.  
6. **Craft details** — aligned columns, consistent icon optical size, matching corner radii, even gaps.  
7. **Real context** — food/planning imagery or metaphors only if they clarify; skip stock collage clutter.

---

## 9. Performance & WebView (APK)

- Prefer CSS over JS layout thrash.  
- Avoid hover-only affordances; always have press states (`:active`).  
- `viewport-fit=cover` + safe areas.  
- `16px+` inputs; `user-select` text in fields only.  
- Offline-first UI must remain readable without network fonts (system fallback stack OK if distinctive sizes/weights carry hierarchy).

---

## 10. Implementation checklist (pass before done)

- [ ] Body ≥ 16px on mobile; line-height ≥ 1.45  
- [ ] Tap targets ≥ 44px; bottom content cleared of nav  
- [ ] Safe-area insets applied  
- [ ] Contrast OK for body + muted + accent buttons  
- [ ] One accent system; no purple/cream-terracotta/broadsheet defaults  
- [ ] Spacing from the shared scale; no random 13/17/22 gaps  
- [ ] Sections have one job; reduced chrome  
- [ ] Works at 360px width without horizontal page scroll (except intentional carousels)  
- [ ] Desktop/tablet not broken (progressive enhancement)  
- [ ] All existing features still reachable  
- [ ] `www/` synced if Capacitor app  

---

## References

For deeper tables and token recipes, see [references/tokens-and-patterns.md](references/tokens-and-patterns.md).
