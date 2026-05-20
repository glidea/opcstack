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

| Page type                        | Layout                                               |
| -------------------------------- | ---------------------------------------------------- |
| Document pages (docs/legal/blog) | Constrained readable document shell                  |
| Landing pages (home/product)     | Full-width, sections control own max-width           |
| Workspace pages (dashboard)      | Full-width with sidebar via SvelteKit layout nesting |

### Icons

All icons come from `lucide-svelte`. Do not introduce other icon libraries.

### Viewport Verification

After frontend changes, verify mobile and desktop viewports.

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

| Need                            | Component                |
| ------------------------------- | ------------------------ |
| Critical warning, must respond  | Alert dialog             |
| Multi-field create/edit form    | Sheet (side panel)       |
| Detail/options for one item     | Popover                  |
| Contextual actions (3+ options) | Dropdown menu            |
| Async result confirmation       | Toast                    |
| Field-level validation error    | Inline error under field |

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
1. Icon (lucide, muted)
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
- [ ] Verified at mobile and desktop viewport

---

## Style: apple-saas

**Apple precision × SaaS density.** Apple's obsessive craft details — antialiased rendering, monochrome palette, invisible chrome, micro-interaction feedback — applied at the tighter density that workspace products demand.

Reference products: Linear, Raycast, Vercel Dashboard.

### What we keep from Apple

- Press feedback on all buttons
- Single monochrome accent — no second brand color
- Ultra-light borders — chrome disappears
- Tight display headline tracking
- Antialiased font rendering
- Glass navigation bar
- No shadows on UI chrome — shadow reserved for product imagery only
- Surface color alternation as section divider

### What we change for SaaS

| Apple                         | Our system                    | Why                             |
| ----------------------------- | ----------------------------- | ------------------------------- |
| Gallery-like control density  | Workspace control density     | Forms and toolbars need density |
| Large reading body text       | Compact workspace body text   | More content per viewport       |
| Pill buttons                  | Compact rounded buttons       | Pill wastes space in dense UI   |
| Large section padding         | Tighter section padding       | Workspace, not gallery          |
| Spacious cards                | Tighter cards                 | More info per viewport          |

### Elevation Rules

| Level    | Treatment               | Use                  |
| -------- | ----------------------- | -------------------- |
| Flat     | No shadow, no border    | Sections, nav, body  |
| Hairline | `border-surface-border` | Cards, containers    |
| Input    | `border-input`          | Form controls        |
| Product  | `shadow-product`        | Product imagery only |

**No shadows on buttons, cards, or chrome. Ever.**

### Liquid Glass — Usage Rules

**Where to use:** Navigation bar, Dialog/Modal, Dropdown/Popover, Toast/Notification.

**Where NOT to use:** Cards, sidebars, form inputs, buttons, page backgrounds, table rows.

Details: Sub-pixel borders on glass elements. Float shadow allowed on overlays (detached from document flow). Spring curves for scale/position transforms only; standard easing for opacity/color.

### Radius

Use the radius scale from `src/web/app.css`. Workspace UI uses compact radius; pill radius is reserved for explicit pill variants.

### Dark Mode

- Apple-faithful dark, not OLED dark. Background is dark grey, not pure black
- Elevation by lightening. Higher surfaces get lighter
- Borders carry more opacity in dark
- Glass saturation drops in dark
- Glass float-shadow strengthens in dark
- What does not change: radius, typography, spacing, press feedback, glass usage, blur hierarchy

### Do's and Don'ts

**Do:**
- Use translucent borders
- Keep buttons and inputs at the same height in forms
- Use `antialiased` font rendering
- Use negative letter-spacing on headlines only
- Use consistent press feedback
- Use surface color change as section dividers
- Use liquid glass only on nav bar and floating overlays

**Don't:**
- Don't use pill radius in workspace UI
- Don't add shadows to cards or buttons
- Don't use gradients as decoration
- Don't use unsupported type weights
- Don't use oversized body text in workspace pages
- Don't use opaque heavy borders
- Don't apply glass material to content areas, sidebars, cards, or form inputs
- Don't use spring curves on opacity or color transitions

---

## Style: brutalism

**Neo Brutalism.** UI as printed matter turned into physical controls. Every important object has a hard black edge. Every primary action has a visible offset shadow. Every press feels like the element moves down into the page.

Reference products: Gumroad, indie SaaS landing pages, YouMind Nano Banana Pro.

### Key Characteristics

- Hard black borders define every primary surface and control
- Offset shadows create object weight without blur
- Saturated accent panels carry section identity
- Heavy uppercase typography makes headings loud
- Cards use a black backplate instead of soft elevation
- Button feedback is physical: hover shifts down, active shifts further and removes shadow
- Rectangular geometry — zero radius is the default

### Color Rules

Concrete color values live in `app.css`. These are the usage rules:

- **Primary** is the action color — used for CTA buttons and key interactive elements
- **Accent (yellow)** is exclusively for "selected / active / featured" state. No other color may carry selection semantics
- **Background** is warm (off-white/cream), not cold grey
- **All borders and shadows** are pure black
- Decorative backgrounds use saturated, bold colors — not pastels

### Typography Rules

- Font: Inter, system-ui, sans-serif
- Display: black weight, uppercase (English only; CJK relies on weight and size)
- Body: medium weight, zero letter-spacing (no negative tracking)
- Weight ladder: body → structural → inline strong → display

### Radius

All structural elements use zero radius. Pill is reserved for status pills, meta chips, and notification dots only.

### Elevation & Shadows

- All shadows are hard, black, offset. No blur. No ambient elevation
- Larger elements get larger shadow offsets
- Shadow tiers: control (small) → nav → container → card backplate

### Press Feedback

- Hover: element shifts slightly toward its shadow
- Active: element shifts fully into shadow position, shadow disappears
- Larger elements have larger displacement

### Navigation

Solid background + thick black bottom border. No glass, no blur.

### Focus State

Solid outline with offset on all interactive elements. On accent-colored surfaces, ring switches to a contrasting color.

### Dark Mode

Not specified for v1. Brutalism's heavy black structure makes dark mode low-priority.

### Do's and Don'ts

**Do:**
- Use black borders as primary structure
- Use hard offset shadows only, never blurred
- Use accent color exclusively for selected/featured/active emphasis
- Use physical press feedback on every clickable object
- Keep primary CTA labels ≤ 3 words
- Provide visible focus ring on every interactive element

**Don't:**
- Don't use glassmorphism or backdrop-blur
- Don't use rounded corners on structural elements
- Don't use blurred shadows
- Don't use low-contrast gray borders
- Don't use green/orange/red as decorative backgrounds (reserved for status)
- Don't use decorative blobs or ambient glow
