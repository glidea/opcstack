# Design System

> Active style is controlled by `DESIGN_SYSTEM` in `.env`
> Valid values: `apple-saas` (default) | `brutalism`

---

## Shared Rules (All Styles)

### Component-first Principle

Pages compose existing primitives; they do not invent new ones.

Before writing `bg-X border rounded-lg p-Y` ask whether you are rebuilding `Card`, `Alert`, or `Empty`. Before writing `<button class="...">` use `Button`. Before writing `<dialog>` use `Dialog` or `AlertDialog`. Before writing a `<div class="fixed bottom-4 right-4 bg-green-600">` use `toast.success(...)`.

UI primitives live in `src/web/lib/ui/*` (alias `$web/ui/*`). Business-level composed components live in `src/web/lib/components/*` (alias `$web/components/*`). The full inventory and bad/good code examples are in `AGENTS.md` under "Component Inventory".

### Token & Style Source of Truth

All concrete values (colors, radii, typography sizes, animations) live in `src/web/app.css`. Component-level sizes (button height, input height, card padding) live in the component files themselves.

**Do not duplicate concrete values in page files.** Use semantic tokens and utility classes:
- Colors: `bg-primary`, `text-muted-foreground`, `border-input`, etc.
- Typography: `text-hero-display`, `text-display-lg`, `text-display-md`, `text-lead`, `text-tagline`, `text-caption`, `text-fine-print`
- Shadows: `shadow-product` (product imagery only), `shadow-glass-float` (floating overlays only)

### Page Layout Rules

| Page type | Layout |
|-----------|--------|
| Document pages (docs/legal/blog) | `max-w-3xl mx-auto px-6 py-16` |
| Landing pages (home/product) | Full-width, sections control own max-width |
| Workspace pages (dashboard) | Full-width with sidebar via SvelteKit layout nesting |

### Icons

All icons come from `lucide-svelte`. Do not introduce other icon libraries.

### Viewport Verification

After frontend changes, verify at 375px and 1440px viewport.

### UI Copy

Titles, headings, descriptions, button labels, and placeholder text must not end with punctuation (no trailing period, comma, or full stop in any language).

---

## Behavior & Accessibility Contract

Every page must satisfy these rules regardless of active style.

### 1. Reduce Motion

When `prefers-reduced-motion: reduce` is active:
- Drop motion-based press feedback (scale/translate), keep opacity/color change for affordance
- Page transitions: replace position/scale with crossfade
- Skeleton shimmer: switch to static placeholder color
- Opacity and color transitions can stay (not motion-sensitive)

### 2. State Communication: Color Is Never Alone

Status must be conveyed by **icon + label + color** together.

| State   | Icon (lucide)    | Required label               |
| ------- | ---------------- | ---------------------------- |
| Success | `check-circle`   | "Saved", "Done", "Connected" |
| Warning | `alert-triangle` | Specific consequence         |
| Error   | `x-circle`       | What failed + how to fix     |
| Info    | `info`           | Context                      |

For form fields: error state = border + `aria-invalid="true"` + visible error message.

### 3. Destructive Actions: Undo Over Confirmation

| Action type                                     | Pattern                                         |
| ----------------------------------------------- | ----------------------------------------------- |
| Delete item, archive, hide, unfollow            | Execute immediately + Toast with "Undo" (5–10s) |
| Bulk delete (>10 items)                         | Execute + longer undo (30s) or trash bin        |
| Permanent delete (account, billing, paid asset) | Confirmation dialog with typed confirmation     |
| Send email, charge card, publish to public      | Confirmation dialog                             |
| Logout, switch workspace                        | Inline button, no confirmation                  |

Confirmation dialogs must use specific verbs ("Delete account", not "OK") and `destructive` button variant.

### 4. Modality Decision

| Need                            | Component                   |
| ------------------------------- | --------------------------- |
| Critical warning, must respond  | Alert dialog                |
| Multi-field create/edit form    | Sheet (side panel)          |
| Detail/options for one item     | Popover                     |
| Contextual actions (3+ options) | Dropdown menu               |
| Async result confirmation       | Toast                       |
| Field-level validation error    | Inline error under field    |

Rules:
- Modal must always have close affordance (X + Esc + backdrop click for non-destructive)
- Never stack modals
- A dialog with only "OK" is almost always wrong — replace with toast or inline UI

### 5. Loading Hierarchy

| Duration   | Treatment                                      |
| ---------- | ---------------------------------------------- |
| < 100ms    | Show nothing                                   |
| 100ms – 1s | Inline skeleton matching final layout          |
| 1s – 10s   | Progress bar (if measurable) or inline spinner |
| > 10s      | Determinate progress + estimated time + Cancel |

### 6. Empty States

Every list/table/feed that can be empty must render:
1. Icon (lucide, muted, ~48px)
2. One-line explanation of why it's empty
3. One primary action to populate it

### 7. Form Behavior Contract

- Browser autofill supported — correct `autocomplete` attributes on every input
- Paste allowed everywhere
- Validate on blur, clear on change
- Placeholder is hint, not label — every field has visible label above
- Tab order matches visual order; Esc closes form/modal
- Errors are specific and actionable

### 8. Settings Discipline

Before adding a setting, ask: Can a smart default solve this? Can the system infer it? When justified: save on change, group by task, show current value at a glance.

### 9. Verification Checklist

- [ ] Works with `prefers-reduced-motion: reduce`
- [ ] Status conveyed by icon + label, not color alone
- [ ] Destructive actions have undo (or justification why impossible)
- [ ] Modal has Esc-to-close and visible close button
- [ ] Loading states render within 100ms; long ops have cancel
- [ ] Empty states have icon + explanation + action
- [ ] Forms support autofill, paste, keyboard navigation
- [ ] Keyboard-only user can complete primary task
- [ ] Color contrast ≥ 4.5:1 body text, ≥ 3:1 large text / UI (WCAG AA)
- [ ] New color tokens have both light and dark values
- [ ] Verified at 375px and 1440px viewport

---

## Style: apple-saas

**Apple precision × SaaS density.** Apple's obsessive craft details — antialiased rendering, monochrome palette, invisible chrome, micro-interaction feedback — applied at the tighter density that workspace products demand.

Reference products: Linear, Raycast, Vercel Dashboard.

### What we keep from Apple

- `scale(0.95)` press feedback on all buttons
- Single monochrome accent — no second brand color
- Ultra-light borders (`rgba` not hex) — chrome disappears
- Negative letter-spacing on display headlines
- `-webkit-font-smoothing: antialiased` everywhere
- Backdrop-blur navigation bar
- No shadows on UI chrome — shadow reserved for product imagery only
- Surface color alternation as section divider (not borders)

### What we change for SaaS

| Apple | Our system | Why |
|-------|-----------|-----|
| 44px controls | 36px default | Forms and toolbars need density |
| 15px body | 14px body | More content per viewport |
| `rounded-full` (pill) buttons | `rounded-[10px]` default | Pill wastes space in dense UI |
| 80px section padding | 48px section padding | Workspace, not gallery |
| 24px card padding | 16px card padding | Tighter cards, more info |

### Elevation Rules

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat | No shadow, no border | Sections, nav, body |
| Hairline | `border-surface-border` | Cards, containers |
| Input | `border-input` | Form controls |
| Product | `shadow-product` | Product imagery only |

**No shadows on buttons, cards, or chrome. Ever.**

### Liquid Glass — Usage Rules

**Where to use:** Navigation bar, Dialog/Modal, Dropdown/Popover, Toast/Notification.

**Where NOT to use:** Cards, sidebars, form inputs, buttons, page backgrounds, table rows.

Details: Sub-pixel borders (0.5px) on glass elements. Float shadow allowed on overlays (detached from document flow). Spring curves for scale/position transforms only; standard `ease-out` for opacity/color.

### Typography

- Font: SF Pro Display / SF Pro Text / Inter fallback
- Display weights: 600 (semibold)
- Body: 14px, weight 400
- Negative letter-spacing on headlines only
- No uppercase (except brand-specific cases)

### Radius

`rounded-sm` (6px), `rounded-md` (10px), `rounded-lg` (14px), `rounded-xl` (16px)

### Dark Mode

- Apple-faithful dark, not OLED dark. Background is dark grey (`#1d1d1f`), not `#000`
- Elevation by lightening. Higher surfaces get lighter
- Borders carry more opacity in dark
- Glass saturation drops in dark
- Glass float-shadow strengthens in dark
- What does not change: radius, typography, spacing, `scale(0.95)`, glass usage, blur radii

### Do's and Don'ts

**Do:**
- Use `rgba` borders
- Keep buttons and inputs at same height (36px) in forms
- Use `antialiased` font rendering
- Use negative letter-spacing on headlines only
- Use `scale(0.95)` as universal press state
- Use surface color change as section dividers
- Use liquid glass only on nav bar and floating overlays

**Don't:**
- Don't use pill radius in workspace UI
- Don't add shadows to cards or buttons
- Don't use gradients as decoration
- Don't use font-weight 500 or 700
- Don't use body text larger than 14px in workspace pages
- Don't use hex borders
- Don't apply glass material to content areas, sidebars, cards, or form inputs
- Don't use spring curves on opacity or color transitions

---

## Style: brutalism

**Neo Brutalism.** UI as printed matter turned into physical controls. Every important object has a hard black edge. Every primary action has a visible offset shadow. Every press feels like the element moves down into the page.

Reference products: Gumroad, indie SaaS landing pages, YouMind Nano Banana Pro.

### Key Characteristics

- Hard black borders (2–4px) define every primary surface and control
- Offset shadows create object weight without blur
- Saturated accent panels carry section identity
- Heavy uppercase typography (900 weight) makes headings and controls loud
- Cards use a black backplate instead of soft elevation
- Button feedback is physical: hover shifts 1px, active shifts 3px and removes shadow
- Rectangular geometry — `rounded-none` is the default

### Colors

| Token | Value | Use |
|-------|-------|-----|
| Primary | #000000 | Action color, borders, shadows, ink |
| Coral | #FF6B6B | Hero and nav panel background |
| Signal Yellow | #FFE66D | Selected/active/featured state (exclusive) |
| Teal | #4ECDC4 | CTA bands and alternate panels |
| Canvas | #F0F0F0 | Page background |
| Surface | #FFFFFF | Card, input, button fill |

**Yellow exclusivity rule:** Yellow is the only color that means "selected / active / featured." No other accent may carry selection semantics.

**Coral stacking rule:** Coral may appear on nav + hero simultaneously. If a banner is also coral, the hero must switch to surface or teal.

### Typography

- Font: Inter, system-ui, sans-serif
- Display weights: 900 (black)
- Body: 15px, weight 500
- Zero letter-spacing (no negative tracking)
- Uppercase for labels, buttons, chips, nav (English). CJK relies on weight and size instead
- Weight ladder: 500 (body) → 700 (structural ≤18px) → 800 (inline strong) → 900 (display, buttons, labels)

### Radius

All structural elements use `rounded-none` (0px). Pill (`9999px`) is reserved for status pills, meta chips, and notification dots only.

### Elevation & Shadows

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat | No shadow | Page background, large color panels |
| Control | `2px 2px 0 #000` | Small buttons, tags |
| Nav | `3px 3px 0 #000` | Logo lockup, icon buttons |
| Container | `4px 4px 0 #000` | Form shells, title blocks |
| Backplate | Physical black rect offset 8px | Cards |

All shadows are hard, black, offset. No blur. No ambient elevation.

### Displacement Scale (Press Feedback)

| Element size | Hover | Active | Shadow |
|-------------|-------|--------|--------|
| ≤ 44px (icon buttons, chips) | translate(1px, 1px) | translate(2px, 2px) | → none |
| 45–120px (buttons, tags) | translate(1px, 1px) | translate(3px, 3px) | → none |
| ≥ 120px (cards) | translate(-4px, -4px) over backplate | — | backplate reveals more |

### Card Backplate

Black rectangle offset 8px behind the card. On hover, card shifts `translate(-4px, -4px)` revealing 12px of backplate. Grid must reserve extra margin for backplate visibility. Mobile: offset reduces to 6px.

Implementation: use `box-shadow: 8px 8px 0 #000` on card (no extra DOM needed). Hover increases to `12px 12px 0 #000` with `translate(-4px, -4px)`.

### Navigation

Solid coral background + 4px black bottom border. No glass, no blur. Logo in white rectangular shell with 2px border and 3px shadow.

### Focus State

4px solid yellow outline with 2px offset on all interactive elements. On yellow surfaces, ring switches to coral.

### Dark Mode

Not specified for v1. Brutalism's heavy black structure makes dark mode low-priority. The system already uses black as its primary visual element.

### Do's and Don'ts

**Do:**
- Use black borders as primary structure
- Use hard offset shadows only, never blurred
- Keep primary actions black with white text
- Use yellow exclusively for selected/featured/hover emphasis
- Use physical press feedback on every clickable object
- Keep primary CTA labels ≤ 3 words
- Provide visible focus ring on every interactive element

**Don't:**
- Don't use glassmorphism or backdrop-blur
- Don't use large rounded cards
- Don't use blurred shadows
- Don't use low-contrast gray borders
- Don't use coral on more than 2 consecutive bands
- Don't rotate structural surfaces (rotation ≤ 8° only for ribbon-tags)
- Don't use green/orange/red as decorative backgrounds (reserved for status)
- Don't use decorative blobs or ambient glow
