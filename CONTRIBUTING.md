# Contributing to Final Destination

Thank you for your interest in contributing! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Commit Convention](#commit-convention)

## Code of Conduct

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

## Getting Started

```bash
git clone https://github.com/VanGoghCode/Final-Destination.git
cd Final-Destination
npm install
cp .env.example .env.local
# Edit .env.local with your DeepSeek API key
npm run dev
```

## Development Workflow

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/my-feature
   ```

   Branch naming:
   - `feature/*` — new features
   - `fix/*` — bug fixes
   - `docs/*` — documentation
   - `refactor/*` — code refactoring
   - `test/*` — adding tests

2. **Make your changes** and ensure quality gates pass:
   ```bash
   npm run lint        # ESLint
   npm run typecheck   # TypeScript
   npm test            # Tests
   npm run build       # Production build
   ```

3. **Pre-commit hooks** run automatically:
   - Prettier formatting
   - ESLint with auto-fix
   - TypeScript type checking

## Code Style

- **TypeScript strict mode** is enforced (`noImplicitAny`, `strictNullChecks`, etc.)
- **Prettier** handles formatting — don't fight it
- **Follow existing patterns** in the codebase:
  - Section headers: `// ======== SECTION NAME ========`
  - Prompt assembly: System + User separation in `src/lib/prompts/`
  - API routes: One folder per route under `src/app/api/`
  - Components: One file per component in `src/components/`
  - Error handling: Try/catch with meaningful errors, retry with exponential backoff for AI calls

## Testing

- **Framework**: [Bun test](https://bun.sh/docs/cli/test) (`bun:test`)
- **Test location**: Tests live next to the code they test (`*.test.ts`)
- **Coverage goal**: 80%+ for `src/lib/`, meaningful tests for components and API routes

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## Pull Request Process

1. Update the CHANGELOG.md under `[Unreleased]`
2. Ensure all checks pass (lint, typecheck, test, build)
3. Request review from a maintainer
4. Squash merge once approved

## Commit Convention

```
type(scope): Brief description (max 50 chars)

Optional body explaining the "why" (wrap at 72 chars).
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `style`, `perf`

Examples:
```
feat(scraper): Add Ashby job board scraper
fix(ai): Handle rate limit errors with exponential backoff
docs(readme): Add deployment instructions for Vercel
```
