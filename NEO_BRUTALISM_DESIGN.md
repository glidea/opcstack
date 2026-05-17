---
version: alpha
name: Neo Brutalism
description: A high-energy prompt-gallery interface built from hard black borders, offset shadows, saturated color blocks, heavyweight typography, and physical press feedback. Inspired by YouMind's Nano Banana Pro prompt gallery, the system makes the interface feel playable, dense, and immediately actionable.

colors:
  primary: "#000000"
  primary-focus: "#000000"
  primary-on-dark: "#ffffff"
  ink: "#000000"
  body: "#111111"
  body-on-dark: "#ffffff"
  body-muted: "#4b5563"
  canvas: "#F0F0F0"
  surface: "#FFFFFF"
  surface-muted: "#F8F9FA"
  surface-black: "#000000"
  coral: "#FF6B6B"
  yellow: "#FFE66D"
  yellow-strong: "#FFD93D"
  teal: "#4ECDC4"
  orange: "#FF9F1C"
  green: "#C7F464"
  red: "#EF4444"
  border: "#000000"
  on-primary: "#ffffff"
  on-accent: "#000000"
  on-dark: "#ffffff"

typography:
  hero-display:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: 72px
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: 0
    textTransform: uppercase
  display-lg:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: 48px
    fontWeight: 900
    lineHeight: 1.0
    letterSpacing: 0
    textTransform: uppercase
  display-md:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: 32px
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: 0
    textTransform: uppercase
  lead:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: 0
  body-strong:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: 16px
    fontWeight: 800
    lineHeight: 1.35
    letterSpacing: 0
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: 15px
    fontWeight: 500
    lineHeight: 1.55
    letterSpacing: 0
  label:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: 12px
    fontWeight: 900
    lineHeight: 1.0
    letterSpacing: 0.4px
    textTransform: uppercase
  caption:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: 0
  button-large:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: 20px
    fontWeight: 900
    lineHeight: 1.0
    letterSpacing: 0
    textTransform: uppercase
  button-utility:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: 14px
    fontWeight: 900
    lineHeight: 1.0
    letterSpacing: 0
    textTransform: uppercase
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.65
    letterSpacing: 0
  fine-print:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: 11px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 0
  nav-link:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: 13px
    fontWeight: 900
    lineHeight: 1.0
    letterSpacing: 0
    textTransform: uppercase

rounded:
  none: 0px
  xs: 2px
  sm: 4px
  md: 8px
  lg: 12px
  pill: 9999px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 80px

effects:
  shadow-sm: "2px 2px 0 #000000"
  shadow-md: "3px 3px 0 #000000"
  shadow-lg: "4px 4px 0 #000000"
  shadow-xl: "8px 8px 0 #000000"
  text-shadow-lg: "4px 4px 0 #000000"
  press-transform: "translate(3px, 3px)"
  hover-transform: "translate(1px, 1px)"
  card-hover-transform: "translate(-4px, -4px)"

components:
  announcement-bar:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.on-dark}"
    typography: "{typography.label}"
    borderBottom: "4px solid {colors.border}"
    padding: 12px 16px
  global-nav:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.ink}"
    typography: "{typography.nav-link}"
    borderBottom: "4px solid {colors.border}"
    height: 58px
    padding: 12px 24px
  logo-lockup:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.nav-link}"
    border: "2px solid {colors.border}"
    rounded: "{rounded.none}"
    shadow: "{effects.shadow-md}"
    padding: 8px 12px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-large}"
    border: "2px solid {colors.border}"
    rounded: "{rounded.none}"
    shadow: "{effects.shadow-sm}"
    padding: 16px 24px
  button-primary-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.none}"
    transform: "{effects.press-transform}"
    shadow: none
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.button-utility}"
    border: "2px solid {colors.border}"
    rounded: "{rounded.none}"
    shadow: "{effects.shadow-sm}"
    padding: 10px 14px
  button-secondary-active:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    transform: "{effects.press-transform}"
    shadow: none
  button-icon-square:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    border: "2px solid {colors.border}"
    rounded: "{rounded.none}"
    shadow: "{effects.shadow-md}"
    size: 38px
  hero-section:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.on-dark}"
    typography: "{typography.hero-display}"
    borderBottom: "4px solid {colors.border}"
    padding: 48px 24px 56px
  hero-title-block:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.hero-display}"
    border: "4px solid {colors.border}"
    rounded: "{rounded.none}"
    shadow: "{effects.shadow-lg}"
    padding: 8px 24px
  prompt-composer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    border: "2px solid {colors.border}"
    rounded: "{rounded.none}"
    shadow: "{effects.shadow-lg}"
    padding: 8px
  prompt-input-panel:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.none}"
    padding: 16px
  proof-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.pill}"
    shadow: "{effects.shadow-sm}"
    padding: 6px 12px
  sticky-filter-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    borderBottom: "4px solid {colors.border}"
    padding: 12px 16px
  category-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.body-muted}"
    typography: "{typography.label}"
    border: "2px solid {colors.border}"
    rounded: "{rounded.none}"
    padding: 8px 12px
  category-chip-selected:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    border: "2px solid {colors.border}"
    rounded: "{rounded.none}"
    padding: 8px 12px
  prompt-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    border: "4px solid {colors.border}"
    rounded: "{rounded.none}"
    padding: 24px
  prompt-card-backplate:
    backgroundColor: "{colors.surface-black}"
    rounded: "{rounded.none}"
    transform: "translate(8px, 8px)"
  featured-tag:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    border: "2px solid {colors.border}"
    rounded: "{rounded.none}"
    shadow: "{effects.shadow-sm}"
    padding: 6px 12px
    transform: "rotate(6deg)"
  image-frame:
    backgroundColor: "{colors.surface}"
    border: "2px solid {colors.border}"
    rounded: "{rounded.none}"
    shadow: "{effects.shadow-sm}"
    aspectRatio: "16 / 9"
  prompt-snippet:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.ink}"
    typography: "{typography.mono}"
    border: "2px solid {colors.border}"
    rounded: "{rounded.none}"
    padding: 16px
  prompt-snippet-label:
    backgroundColor: "{colors.surface-black}"
    textColor: "{colors.on-dark}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: 4px 8px
  cta-section:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.ink}"
    typography: "{typography.display-lg}"
    borderTop: "4px solid {colors.border}"
    padding: 64px 24px
  footer:
    backgroundColor: "{colors.surface-black}"
    textColor: "{colors.on-dark}"
    typography: "{typography.fine-print}"
    borderTop: "4px solid {colors.border}"
    padding: 40px 24px
---

## Overview

Neo Brutalism is a product interface that behaves like printed UI turned into physical controls. Every important object has a hard black edge. Every primary action has a visible offset shadow. Every press feels like the element moves down into the page.

The YouMind reference uses this language well because the product surface is a prompt gallery. The page needs density, categorization, image previews, and fast actions. A quiet SaaS treatment would make the same content feel generic. The brutalist treatment makes each prompt card feel like a collectible object with clear controls attached.

The system is intentionally direct. It uses saturated color blocks, heavyweight type, rectangular geometry, and visible interaction states. Decoration only works when it reinforces structure: black borders show grouping, offset shadows show clickable objects, color marks state and hierarchy.

**Key Characteristics:**
- Hard black borders define every primary surface and control.
- Offset shadows create object weight without blur.
- Saturated accent panels carry section identity.
- Heavy uppercase typography makes headings and controls loud.
- Cards use a black backplate instead of soft elevation.
- Button feedback is physical: hover shifts by 1px, active shifts by 3px and removes shadow.
- Prompt content is treated like code: mono text, label bars, fixed preview frames.
- Sticky filtering is part of the content system, not an optional toolbar.

## Colors

### Brand & Accent
- **Brutal Black** (`{colors.primary}` - #000000): The action color, border color, hard shadow color, and structural ink. It is the core of the system.
- **Coral Panel** (`{colors.coral}` - #FF6B6B): The main hero and navigation background. It creates the high-energy first impression seen in the YouMind reference.
- **Signal Yellow** (`{colors.yellow}` - #FFE66D): The selected state, featured tag, and high-priority control hover color.
- **Strong Yellow** (`{colors.yellow-strong}` - #FFD93D): Used for announcement emphasis and hover depth when yellow needs a stronger value.
- **Teal Panel** (`{colors.teal}` - #4ECDC4): Secondary large-section background for CTA bands.
- **Orange** (`{colors.orange}` - #FF9F1C): Optional support accent for badges and secondary statistics.
- **Green** (`{colors.green}` - #C7F464): Optional support accent for success or fresh/new states.

### Surface
- **Canvas** (`{colors.canvas}` - #F0F0F0): The page background. Slightly gray so white cards read as objects.
- **Surface** (`{colors.surface}` - #FFFFFF): Card, input, button, and control fill.
- **Muted Surface** (`{colors.surface-muted}` - #F8F9FA): Textarea, prompt snippet body, and nested panels.
- **Surface Black** (`{colors.surface-black}` - #000000): Backplates, snippet label bars, footers, and image overlays.

### Text
- **Ink** (`{colors.ink}` - #000000): Headings, labels, borders, icons.
- **Body** (`{colors.body}` - #111111): Paragraph and long-form text.
- **Body Muted** (`{colors.body-muted}` - #4b5563): Metadata, timestamps, secondary descriptions.
- **Body On Dark** (`{colors.body-on-dark}` - #ffffff): Text on black and saturated dark overlays.

### Borders
- **Border** (`{colors.border}` - #000000): Every structural boundary. The border is not decorative. It is the layout skeleton.

### Brand Gradient
Gradients are not part of the core component language. The only acceptable gradient is a short announcement band where the goal is temporary campaign energy. Main sections, cards, buttons, and filters stay flat.

## Typography

### Font Family
- **Display / UI**: `Inter, system-ui, -apple-system, sans-serif` - Inter gives enough weight range for 900-weight headings and button labels.
- **Mono**: `JetBrains Mono, ui-monospace, monospace` - Used for prompt snippets and structured prompt text.

### Hierarchy

| Token                         | Size | Weight | Line Height | Letter Spacing | Use                                        |
| ----------------------------- | ---- | ------ | ----------- | -------------- | ------------------------------------------ |
| `{typography.hero-display}`   | 72px | 900    | 0.95        | 0              | Hero headline and highlighted title block  |
| `{typography.display-lg}`     | 48px | 900    | 1.0         | 0              | CTA section and large section headline     |
| `{typography.display-md}`     | 32px | 900    | 1.1         | 0              | Sticky title and section headline          |
| `{typography.lead}`           | 18px | 700    | 1.45        | 0              | Hero subcopy and emphasized intro copy     |
| `{typography.body-strong}`    | 16px | 800    | 1.35        | 0              | Card title and strong metadata             |
| `{typography.body}`           | 15px | 500    | 1.55        | 0              | Default body copy                          |
| `{typography.label}`          | 12px | 900    | 1.0         | 0.4px          | Tags, chips, small command labels          |
| `{typography.caption}`        | 12px | 700    | 1.35        | 0              | Metadata and small proof chips             |
| `{typography.button-large}`   | 20px | 900    | 1.0         | 0              | Primary hero action                        |
| `{typography.button-utility}` | 14px | 900    | 1.0         | 0              | Secondary buttons and tool controls        |
| `{typography.mono}`           | 14px | 500    | 1.65        | 0              | Prompt text and code-like content          |
| `{typography.fine-print}`     | 11px | 700    | 1.3         | 0              | Footer and dense secondary notes           |
| `{typography.nav-link}`       | 13px | 900    | 1.0         | 0              | Header links and compact nav labels        |

### Principles

- **Weight is the voice.** Display and controls use 900. This is not a subtle system.
- **Letter spacing stays simple.** No negative tracking. Brutalist type should feel printed and direct.
- **Uppercase is structural.** Use uppercase for English labels, buttons, chips, and nav. Chinese text relies on weight and size instead.
- **Mono is for prompts.** Do not use mono as decoration. Use it only when the content is prompt text, code-like syntax, or structured metadata.
- **Short text wins.** Button and chip labels should read as commands, not explanations.

## Layout

### Spacing System
- **Base unit:** 8px.
- **Tokens:** `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 16px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 48px · `{spacing.section}` 80px.
- **Section vertical padding:** 48px to 80px. Saturated sections can be tighter because the color already carries separation.
- **Card padding:** `{spacing.lg}` 24px.
- **Control gap:** 8px to 12px.
- **Grid gap:** 28px to 32px.

### Page Structure

```
announcement-bar
global-nav
hero-section
prompt-composer
proof-chip-row
sticky-filter-bar
prompt-card-grid
cta-section
footer
```

### Grid & Container
- **Max content width:** 1200px for hero and prompt grid.
- **Prompt grid desktop:** 3 columns with 32px gap.
- **Prompt grid tablet:** 2 columns with 28px gap.
- **Prompt grid mobile:** 1 column with 32px gap.
- **Hero composer width:** max 768px centered.
- **Sticky filter width:** full width with inner 1200px container.

### Density Philosophy

This system should feel dense but not cramped. Density comes from visible grouping and compact controls. It should not come from tiny text or weak spacing. If a page feels noisy, remove secondary copy before reducing borders or weakening type.

## Elevation & Depth

| Level           | Treatment                         | Use                                     |
| --------------- | --------------------------------- | --------------------------------------- |
| Flat            | No shadow                         | Page background and large color panels  |
| Control Shadow  | `{effects.shadow-sm}`             | Small buttons, tags, image tools        |
| Nav Shadow      | `{effects.shadow-md}`             | Logo lockup, nav tools, counters        |
| Composer Shadow | `{effects.shadow-lg}`             | Hero composer and title highlight       |
| Backplate       | `{effects.shadow-xl}` via element | Prompt cards and large framed objects   |

**Shadow philosophy.** Shadows are hard, black, and offset. No blur. No ambient elevation. If a thing is clickable or collectible, it can have a hard shadow. If a thing is just a page section, use color and border instead.

### Pressed State

Controls move like physical objects:

- Hover: `transform: translate(1px, 1px)` and reduce shadow by one level.
- Active: `transform: translate(3px, 3px)` and remove shadow.
- Card hover: inner card moves `translate(-4px, -4px)` over its black backplate.

## Shapes

### Border Radius Scale

| Token            | Value        | Use                                              |
| ---------------- | ------------ | ------------------------------------------------ |
| `{rounded.none}` | 0px          | Cards, buttons, panels, filters, input frames    |
| `{rounded.xs}`   | 2px          | Rare internal media correction                   |
| `{rounded.sm}`   | 4px          | Small embedded objects only                      |
| `{rounded.md}`   | 8px          | Rare modal or popover shell                      |
| `{rounded.lg}`   | 12px         | Rare large temporary overlay                     |
| `{rounded.pill}` | 9999px       | Proof chips, notification dots, close buttons    |
| `{rounded.full}` | 9999px / 50% | Circular status dots and carousel indicators     |

### Geometry Rules

- Main surfaces are rectangular.
- Buttons are rectangular.
- Chips are rectangular except proof chips.
- Images are rectangular and framed with black border.
- Round shapes are reserved for status, avatars, close buttons, and carousel dots.

## Components

### Navigation

**`announcement-bar`** - A short campaign strip with saturated background, white text, and a 4px black bottom border. It may use a temporary gradient only when the message is promotional.

**`global-nav`** - A coral header with black bottom border. Logo and utility actions sit inside white hard-shadow controls. Right-side actions prefer square icon buttons.

**`logo-lockup`** - White rectangular logo shell with 2px black border and 3px offset shadow. It should look like a physical label attached to the header.

### Buttons

**`button-primary`** - Black background, white text, 2px black border, hard shadow, 900-weight uppercase label. Used for the main generation or conversion action.

**`button-secondary`** - White background, black text, 2px black border, hard shadow. Hover may turn yellow.

**`button-icon-square`** - 38px square white icon button with black border and 3px hard shadow. Used for search, download, help, RSS, share, and language controls.

### Hero

**`hero-section`** - Coral panel with 4px black bottom border. Contains the primary title, highlighted title block, subtitle, composer, and proof chips.

**`hero-title-block`** - White inline title block with 4px black border and 4px hard shadow. Used for the key noun in the hero title.

**`prompt-composer`** - White framed shell with 2px border and 4px shadow. Contains one muted input panel and one primary action.

**`prompt-input-panel`** - Muted inner panel for textarea and tool buttons. It uses a thinner 1px black border to separate nested input from the outer composer.

**`proof-chip`** - Small pill for social proof or count. It can be rounded because it is metadata, not a primary control.

### Filtering

**`sticky-filter-bar`** - Sticky full-width filter surface on canvas background with black bottom border. It holds search, sort, category chips, count, and utility actions.

**`category-chip`** - Rectangular white filter chip. It has no shadow by default because a long horizontal chip row becomes too heavy with repeated shadows.

**`category-chip-selected`** - Same geometry as `{component.category-chip}` but yellow fill and black text.

### Cards

**`prompt-card`** - White card with 4px black border and 24px padding. It sits above `{component.prompt-card-backplate}` to create the collectible card effect.

**`prompt-card-backplate`** - Black rectangle positioned behind the card and offset by 8px.

**`featured-tag`** - Yellow tag with black border, hard shadow, and 6 degree rotation. It may float slightly outside the card corner.

**`image-frame`** - 16:9 media area with 2px black border and small hard shadow. Image uses `object-fit: cover`.

**`prompt-snippet`** - Muted prompt text block with mono typography and 2px black border.

**`prompt-snippet-label`** - Black label bar attached to the prompt snippet. Label text is uppercase and white.

### Sections

**`cta-section`** - Teal large action band with black top border. It uses a large display headline and one black primary button.

**`footer`** - Black footer with white text and black-border continuity from the page above.

## Do's and Don'ts

### Do
- Use black borders as the primary structure.
- Use hard offset shadows only, never blurred shadows.
- Keep primary actions black with white text.
- Use yellow for selected state, featured state, and secondary emphasis.
- Use mono typography only for prompt content.
- Put real controls in the first viewport.
- Keep images inside hard rectangular frames.
- Use physical press feedback on every clickable object.

### Don't
- Don't soften the UI with glassmorphism.
- Don't use large rounded cards.
- Don't use blurred shadows.
- Don't use low-contrast gray borders.
- Don't write long CTA copy.
- Don't make every accent color appear in the same viewport.
- Don't rotate body cards.
- Don't use decorative blobs or ambient glow.

## Responsive Behavior

### Breakpoints

| Name             | Width       | Key Changes                                                           |
| ---------------- | ----------- | --------------------------------------------------------------------- |
| Small phone      | ≤ 419px     | Single column, hero title 40px, composer stacks vertically            |
| Phone            | 420-640px   | Single column, sticky tools collapse to icon buttons                  |
| Tablet portrait  | 641-833px   | Two-column grid only if card content stays readable                   |
| Tablet landscape | 834-1023px  | Two-column prompt grid, full filter row                               |
| Desktop          | 1024-1440px | Three-column prompt grid, full hero composition                       |
| Wide desktop     | ≥ 1441px    | Content locks at 1200px, outer margins absorb extra width             |

### Touch Targets
- Minimum touch target is 38px for compact icon buttons.
- Primary actions should be at least 48px tall.
- Category chips should not drop below 32px height.
- Card actions should stay visible on mobile rather than relying on hover.

### Collapsing Strategy
- Header utility labels hide before icons disappear.
- Composer tools move below textarea on mobile.
- Category chips remain horizontally scrollable.
- Sort and filter become icon buttons on mobile.
- Prompt card actions stack only when labels would overflow.

### Image Behavior
- Prompt images keep `aspect-ratio: 16 / 9`.
- Preview image uses `object-fit: cover`.
- Cards should not change height because an image loads.
- Carousel dots stay inside the image frame.

## Iteration Guide

1. Start from the YAML tokens at the top of this file.
2. Reference component keys directly, for example `{component.prompt-card}`.
3. Add variants as separate component entries.
4. Keep component states explicit: default, hover, active, selected.
5. Do not inline random accent colors.
6. Use hard shadow tokens from `effects:`.
7. If hierarchy is unclear, increase border or type weight before adding decoration.
8. If the page feels noisy, remove copy before reducing structural contrast.

## Known Gaps

- Modal, toast, and form validation states are not fully specified.
- Dark-mode inversion is not specified because the base style already uses heavy black structure.
- Exact icon set is not specified, but line icons should use thick enough strokes to survive next to 2px borders.
- Data table treatment is not specified.
