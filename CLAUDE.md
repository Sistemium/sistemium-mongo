# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**sistemium-mongo** is a MongoDB/Mongoose abstraction library providing a Koa-based REST API framework with automatic CRUD endpoint generation, bulk merge operations, cursor-based pagination, and aggregation pipeline builders.

## Build & Lint Commands

```bash
npm run build        # tsc — compiles src/*.ts to lib/ (CommonJS, ES2022)
npm run watch        # tsc-watch for development
npm run lint         # eslint src
```

There are no tests configured in this project.

## Architecture

The library is structured as a small set of focused modules in `src/`, all re-exported from `src/index.ts`:

- **schema.ts** — Core `ModelSchema` class wrapping Mongoose schemas. Adds bulk `merge()`/`mergeIfChanged()` via MongoDB bulkWrite, auto UUID generation, timestamp tracking (`ts`/`cts`), creator tracking, and `findAll()` with aggregation pipeline support and cursor-based pagination.
- **api.ts** — REST handlers (`getHandler`, `getManyHandler`, `postHandler`, `patchHandler`) and `defaultRoutes()` which auto-generates CRUD endpoints for a map of models. Uses custom headers: `x-page-size`, `x-offset`, `x-patch`, `x-sort`.
- **koa.ts** — `KoaApi` class: Koa app factory with CORS, morgan, body parser, auto MongoDB connect, graceful SIGINT shutdown. Configured via `REST_PORT`, `MORGAN_FORMAT` env vars.
- **mongoose.ts** — Connection management (`connect`/`disconnect`/`connection`). Uses `MONGO_URL` env var.
- **pipeline.ts** — Aggregation pipeline builders for relationships: `toOneLookup`, `toOneOrZeroLookup`, `top1Lookup`, `toMany`, `toManyFiltered`.
- **predicates.ts** — Query filter builders. Converts query params to MongoDB filters supporting operators: `==`, `<`, `>`, `<=`, `>=`, `in`, `like` (regex with `%` wildcards).
- **util.ts** — Timestamp offset encoding/decoding for cursor-based pagination.
- **Archive.ts** — Soft delete: archives documents before deletion with creator/timestamp metadata.

## Key Patterns

- **Cursor-based pagination** via MongoDB Timestamps encoded as offset strings, not skip/limit.
- **Bulk operations** — all merge methods use `bulkWrite` for efficiency.
- **Role-based filtering** — models can define `rolesFilter()` for context-aware query scoping.
- **Query flexibility** — supports both query params and `where:` JSON filter clauses.
- **ESLint** — airbnb-base; `ctx` and `session` param reassignment is allowed.
- Output is CommonJS in `lib/` with `.d.ts` declarations.
