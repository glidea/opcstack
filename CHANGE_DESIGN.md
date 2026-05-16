# Design System Migration SOP

```
1. Extract → 2. Map → 3. Apply → 4. Scan → 5. Verify → 6. Update rules
```

Core Principle: **Tokens are the single source of truth.** No hardcoded colors, border radius, or shadows in component code. Always use CSS variables.

---

## Step 1: Extract Design Tokens from Target

Use DevTools on the target website to grab:

- **Colors**: primary, foreground, background, muted, border (both light and dark schemes)
- **Border radius**: 4 levels—small, medium, large, pill (px values)
- **Typography**: font-family, body font-size, heading levels’ size + weight + letter-spacing
- **Shadows**: Are they used? In which scenarios?
- **Spacing/density**: Button height, input height, card padding
- **Motion/Effects**: How are hover/active states handled? (scale? translate? opacity?)

Update DESIGN.md with all findings.

## Step 2: Map to app.css Tokens

Open `src/web/app.css` and replace the values in the `@theme` block:

```css
/* Only replace values, never variable names */
--color-primary: <new-value>;
--color-background: <new-value>;
--radius-sm: <new-value>;
--radius-md: <new-value>;
--radius-lg: <new-value>;
```

Keep variable names (shadcn semantic names) unchanged. All components will follow automatically.

## Step 3: Apply to Components

~80% coverage comes from app.css tokens. Manually update the remaining ~20%:

| What to Change                                  | Where to Update        |
| ----------------------------------------------- | ---------------------- |
| Button shape (pill vs square, active effects)   | `button.svelte`        |
| Popover border strategy (border vs ring+shadow) | All `*-content.svelte` |
| Input height/border radius                      | `input.svelte`         |
| AppHeader style (blur? solid? transparent?)     | `AppHeader.svelte`     |

## Step 4: Global Scan for Violations

```bash
# Hardcoded border radius
rg "rounded-\w+" src/web/ -g "*.svelte"

# Hardcoded shadow
rg "shadow-" src/web/ -g "*.svelte"

# Hardcoded colors (not token references)
rg "#[0-9a-fA-F]{3,8}" src/web/ -g "*.svelte"

# ring usage (should often be replaced by border)
rg "ring-" src/web/ -g "*.svelte"
```

Systematically fix all issues to use tokens or newly defined standard values.

## Step 5: Verify

```bash
pnpm exec svelte-check --threshold warning
```

Manually review in browser: landing page, docs page, workspace.

## Step 6: Update AGENTS.md

Document the new design rules in the Frontend Design Contract section of `AGENTS.md` to ensure consistent development going forward.
