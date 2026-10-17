# Instructions for AI agents working on briefluence

## Project rules (from the build spec)

1. Work one phase at a time, in order. At the end of each phase run lint, typecheck and tests; fix everything before moving on.
2. Before choosing between two approaches that change the architecture, list the options with pros and cons and wait for the owner's choice.
3. Never invent third-party API fields, scopes or endpoints. Read the current official docs for Meta, TikTok, Google and Ameriabank first and link them in code comments.
4. Secrets only in env variables; social tokens encrypted at rest; never log tokens, passwords or card data.
5. Validate every input with shared Zod schemas on both web and API; return typed errors.
6. Every endpoint checks the role and ownership (a brand can only touch its own deals and applicants).
7. Business logic (match score, eligibility, subscription state changes) lives in pure functions with unit tests (`packages/shared/src/domain`).
8. Money stored as integers in minor units; dates stored in UTC, shown in Asia/Yerevan.
9. UI text goes through next-intl in **all three languages (en, ru, hy)**. Never hard-code UI strings.
10. Small commits with clear messages; keep `README.md` current.

## Frontend rules

- Build screens only from the design system in `packages/ui` (Block, Stack, Grid, Container, Heading, Text, Icon, Button, Card, Badge, Field…). Add new primitives there, not ad hoc in pages.
- Follow the brand book: `packages/ui/src/brand/README.md`. Colors only from tokens (`bg-surface`, `text-ink`, `bg-primary`, `text-primary-text`, `bg-sun` only for barter); pills for buttons/chips, `rounded-card` for cards; brand type scale (`text-display/h1/h2/body/small/label`); Russian/Armenian headings never use Syne (handled in CSS).
- Responsive props use Tailwind breakpoints (`sm md lg xl 2xl`), e.g. `cols={{ base: 1, md: 2 }}`; layouts must work at 360px with 16px side padding and 44px touch targets.
- Voice: warm, direct, informal ("ты" / "դու"), no hype, no emoji.
- Translations for most namespaces are generated: edit `apps/web/messages/_src/*.mjs` ([en, ru, hy] tuples) and run `node scripts/write-messages.mjs messages/_src/<file>.mjs`. `pnpm --filter @briefluence/web test` checks all locales have the same keys and placeholders.
