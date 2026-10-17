# Briefluence brand — source of truth

The full brand book (BRAND.md) lives with the design team; this folder holds the files the code uses.

**Palette v2 (2026-10-16):** the owner replaced coral with a magenta primary and lighter surfaces. Tokens were renamed `coral*` → `primary*` (`bg-primary`, `text-primary-text`, `bg-primary-soft`, `text-on-primary`); `sun` (barter) is now a light yellow.

| File | What |
| --- | --- |
| `tokens.css` | All design tokens as `--bf-*` CSS variables, light + dark |
| `tailwind-v4.css` | Tailwind v4 `@theme` mapping → `bg-surface`, `text-ink`, `bg-primary`, `rounded-card`, `rounded-pill`, `text-h1`… |
| `logos/` | Mark (currentColor / primary / ink / white) and app icon |

## Rules (apply to every screen)

1. Colors only from tokens; never raw hex in components.
2. Page background `surface`; cards `surface-raised` with `border-line`.
3. One primary (primary) button per screen area.
4. `sun` only for barter / rewards (text on it is always `ink`).
5. Buttons and chips are pills (`rounded-pill`); cards are 16px (`rounded-card`); inputs 8px (`rounded-sm`).
6. Small primary text uses `primary-text`, never `primary`.
7. Works in light and dark theme without extra code (tokens switch automatically).
8. Mobile-first: 16px side padding, layouts work at 360px width; touch targets ≥ 44px.
9. Headings use Manrope (Noto Sans Armenian for Armenian) in every language, so all three look the same.
   Syne (`font-display`) is only for the logo wordmark — owner decision 2026-10-18.
10. No separate error red: errors use `primary-text` + an icon + text. Approved → `success`.
11. Spacing scale 4 / 8 / 16 / 24 / 32 px (Tailwind 1, 2, 4, 6, 8); 12 and 16 (48 / 64 px) only for section rhythm.
12. Voice: warm, direct, informal "you" (ru «ты», hy «դու»), no hype, no emoji, no ALL CAPS except `label` badges.
