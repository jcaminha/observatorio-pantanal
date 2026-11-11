# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

INPP – Observatório de Dados Públicos do Pantanal: a client-only React 19 + Vite + Tailwind v4 dashboard built for TV/wallboard display. It auto-rotates through slides about fires, rivers, rain, deforestation, land cover, economy and biodiversity in the Pantanal. The project was scaffolded in Google AI Studio (`metadata.json`, `.aistudio/`, `.env.example`). UI text, comments in data and domain labels are in Brazilian Portuguese; keep new user-facing strings in pt-BR.

## Commands

The lockfile is `bun.lock` (bun is the intended package manager; npm also works).

- `bun install` / `npm install`
- `npm run dev`: Vite dev server on port 3000, bound to 0.0.0.0
- `npm run build`, then `npm run preview`
- `npm run lint`: type-check only (`tsc --noEmit`); there is no ESLint
- Tests use `node:test`, and there is no test script. Run them with tsx:
  `npx tsx --test src/utils/pantanalLogic.test.ts`
  Plain `node --test` fails because type-only imports (e.g. `FireSpot`) are not marked `import type`.

## Architecture

- **All data is static and mocked.** It lives in `src/data/pantanalData.ts` as typed constants (types in `src/types/pantanal.ts`). Nothing is fetched at runtime. "Live" timestamps and source labels (INPE, ANA, MapBiomas, etc.) are hardcoded strings: in the data file and in the `slides` array in `App.tsx`. `@google/genai`, `express` and `GEMINI_API_KEY` come from the AI Studio template and are not used in `src/`.
- **`App.tsx` is the carousel controller.** It defines the `slides` array (id, title, source, date, icon), runs the 60s auto-advance timer (`CAROUSEL_DURATION_SECONDS`) and handles keyboard controls (←/→, space to pause). It renders one slide component based on the active slide `id`. To add a slide, add an entry to `slides` and a matching `activeSlideId === '...'` branch.
- **Shared state flows down from `App`.** Every slide takes the `isDarkMode` prop. Slides that can be clicked call back with `(data, type)` into `handleSelectFeature`, which opens the generic `StationDetailModal` and pauses the carousel. The modal changes its layout based on `type` (`fire | river | weather | deforestation | corridor | species`).
- **Dark mode** works by toggling a `dark` class on the root div. Tailwind's `dark:` variant is redefined in `src/index.css` (`@custom-variant dark`) to key off that class. Many components also branch on `isDarkMode` directly. Light mode (white with INPP blue) is the default.
- **Map:** only `SituationMapTab.tsx` uses Leaflet, imperatively through refs (map instance, tile layer and layer groups are created in `useEffect`, not with react-leaflet). Leaflet styling overrides are in `src/index.css`.
- **Charts are hand-built** (SVG/divs in the TSX). There is no charting library.
- **Pure logic** (river status classification, fire filtering/summaries, Pearson correlation, pt-BR number formatting) lives in `src/utils/pantanalLogic.ts`. This is the only tested module.
- Imports use explicit `.ts`/`.tsx` extensions (`allowImportingTsExtensions`). The `@/*` alias maps to the repo root.
- Static images are served from `public/assets/` and referenced by absolute paths like `/assets/images/...`.

## Backend (`backend/`)

Python 3.13 package `observatorio`: ETL pipelines, PostGIS schema, FAIR catalog and a FastAPI REST API. The frontend does not consume it yet (it still uses the mocked data). Run instructions, test command and the pipeline table are in `backend/README.md`.

- Everything runs in Docker (`docker-compose.yml` at the repo root: `db`, `migrar`, `api` on 8001, `agendador`). There is no local virtualenv. `PYTHONPATH=/app` in the image, so mounting `backend/` on `/app` runs the working tree without a rebuild.
- No ORM: the schema is raw SQL in `backend/migrations/versions/`, and queries use SQLAlchemy `text()`. A schema change means a new Alembic revision.
- Every pipeline is a `Pipeline` subclass run through `etl.base.rodar`, which records an `execucao_etl` row (provenance), loads in one transaction and calls `alertas.notificar_falha` on failure. New pipelines are added to `etl/registro.py`, `AGENDA_PADRAO` in `config.py` and `CONJUNTOS` in `catalogo.py`.
- All aggregated series go in `serie_territorial` (territory × variable × date). Derived indicators are fully recomputed into `indicador` by the `indicadores` pipeline; the maths lives in `indicadores/calculo.py` as pure functions.
- Code identifiers, table names and API fields are in Portuguese.

## AI Studio constraint

`vite.config.ts` turns off HMR and file watching when `DISABLE_HMR=true`, which AI Studio sets. Keep that behavior as is.
