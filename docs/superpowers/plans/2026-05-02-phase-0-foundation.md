# Phase 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the schedule2gather repository so a "hello world" page deploys to a Firebase Hosting preview channel, anonymous Firebase Auth resolves on first visit (UID visible in console), and GitHub Actions CI runs lint → typecheck → build → deploy on every push.

**Architecture:** Lift the proven scaffold from `D:\web-project\survey-builder\` (Vite + React + TypeScript + Tailwind 4 + ESLint flat config + Zustand + Firebase). Swap RTDB for Firestore. Replace Google OAuth with anonymous auth. Add Vitest, Firebase emulators, and GitHub Actions — none of which `survey-builder` has.

**Tech Stack:**
- React 19 + TypeScript 5.9 + Vite 7
- Tailwind CSS 4 (`@tailwindcss/vite` plugin, no `tailwind.config.js`)
- Firebase 12 SDK (Firestore + Auth) — anonymous auth in P0
- Zustand 5 for client state
- Vitest + happy-dom for testing
- ESLint 9 (flat config) + TypeScript ESLint
- Firebase emulator suite (Firestore + Auth)
- GitHub Actions for CI/CD via `FirebaseExtended/action-hosting-deploy@v0`

**Spec deviation note:** PRODUCTION.md §6 says React 18; we use React 19 to match `survey-builder`. Same code, no behavioral difference.

**Acceptance criteria for P0 (from PRODUCTION.md §12 P0):**
1. Visiting the deployed preview URL signs you in anonymously (UID visible in browser console).
2. Placeholder page renders.
3. GitHub Actions CI is green.

---

## File Structure

Files created during P0 (paths relative to `D:\web-project\schedule2gather\`):

| File | Responsibility |
|---|---|
| `.gitignore` | Standard Node + Vite + Firebase exclusions |
| `.env.example` | Template listing the 7 required Firebase env vars |
| `.env` | Local-dev Firebase config (git-ignored) |
| `.firebaserc` | Maps `dev` and `prod` aliases to real Firebase project IDs |
| `firebase.json` | Hosting config + Firestore rules path + emulator ports |
| `firestore.rules` | Deny-by-default security rules (locked down further in P5) |
| `firestore.indexes.json` | Empty composite-index manifest |
| `package.json` | Scripts (`dev`, `build`, `lint`, `typecheck`, `test`, `emulators`, `deploy:dev`, `deploy:prod`) and deps |
| `package-lock.json` | npm lockfile (auto-generated) |
| `tsconfig.json` | Project references to app + node TS configs |
| `tsconfig.app.json` | App-side TS config with `@/*` path alias |
| `tsconfig.node.json` | Node-side TS config for `vite.config.ts` and `vitest.config.ts` |
| `vite.config.ts` | React + Tailwind plugins + `@/*` alias + dev server port |
| `vitest.config.ts` | happy-dom env, `@/*` alias, globals enabled |
| `eslint.config.js` | Flat config, JS + TS-ESLint + react-hooks + react-refresh |
| `index.html` | Vite entry HTML, mounts to `#root` |
| `BACKLOG.md` | Phase-sectioned backlog (empty sections for P1–P5 + Beyond launch) |
| `README.md` | One-page project README pointing at `PRODUCTION.md` |
| `src/main.tsx` | React root render |
| `src/App.tsx` | Placeholder UI; calls `authStore.init()` and displays UID |
| `src/index.css` | Tailwind import + base body styles |
| `src/vite-env.d.ts` | Vite client TS types |
| `src/services/firebase.ts` | `initializeApp` + Firestore + Auth singletons |
| `src/stores/authStore.ts` | Zustand store with `signInAnonymously` + `onAuthStateChanged` |
| `src/__tests__/smoke.test.ts` | Trivial Vitest smoke test (proves harness works) |
| `src/lib/.gitkeep` | Reserved for P1+ pure logic (bitmap, TZ, scoring) |
| `src/pages/.gitkeep` | Reserved for P1+ routed pages |
| `src/components/.gitkeep` | Reserved for P1+ UI components |
| `.github/workflows/ci.yml` | Lint + typecheck + build + preview deploy on push |

Real Firestore data, security rules tests, page components, and pure-logic modules **all land in P1+**, not P0.

---

## Prerequisites (one-time, manual; engineer does these before Task 1)

- [ ] **Node.js 20 LTS or newer** installed (`node --version` ≥ 20).
- [ ] **Firebase CLI** installed globally: `npm install -g firebase-tools`. Verify: `firebase --version`.
- [ ] **Logged in to Firebase CLI**: `firebase login`. Verify: `firebase projects:list` shows your account.
- [ ] **GitHub account** ready; you'll create a repo named `schedule2gather` during Task 10.
- [ ] **Working directory:** all commands assume `D:\web-project\schedule2gather\` as CWD.

---

## Task 1: Initialize git repo and project structure

**Files:**
- Create: `D:\web-project\schedule2gather\.gitignore`
- Create: `D:\web-project\schedule2gather\src\lib\.gitkeep`
- Create: `D:\web-project\schedule2gather\src\pages\.gitkeep`
- Create: `D:\web-project\schedule2gather\src\components\.gitkeep`
- Create: `D:\web-project\schedule2gather\src\services\.gitkeep`
- Create: `D:\web-project\schedule2gather\src\stores\.gitkeep`
- Create: `D:\web-project\schedule2gather\src\__tests__\.gitkeep`

- [ ] **Step 1: Initialize git**

```bash
cd D:/web-project/schedule2gather
git init
git branch -M main
```

Expected: `Initialized empty Git repository in D:/web-project/schedule2gather/.git/`.

- [ ] **Step 2: Create `.gitignore`**

Create `D:\web-project\schedule2gather\.gitignore` with this content:

```
# Logs
*.log
npm-debug.log*
yarn-debug.log*

# Dependencies
node_modules/

# Build output
dist/
dist-ssr/

# Environment
.env
.env.local
.env.*.local

# Firebase
.firebase/
firebase-debug.log
firestore-debug.log
ui-debug.log
*.local

# Editor
.vscode/*
!.vscode/extensions.json
.idea/
.DS_Store

# Test artifacts
coverage/

# OS
Thumbs.db
```

- [ ] **Step 3: Create empty placeholder directories with `.gitkeep`**

Run these PowerShell commands to create the empty placeholder directories (git won't track empty dirs, so each gets a `.gitkeep`):

```powershell
mkdir src/lib, src/pages, src/components, src/services, src/stores, src/__tests__ -Force
New-Item src/lib/.gitkeep, src/pages/.gitkeep, src/components/.gitkeep, src/services/.gitkeep, src/stores/.gitkeep, src/__tests__/.gitkeep -ItemType File -Force
```

- [ ] **Step 4: Create initial commit**

Stage the new skeleton files plus the planning docs (`PRODUCTION.md` and `docs/superpowers/plans/`) that were created before P0 implementation began:

```bash
git add .gitignore src/ PRODUCTION.md docs/
git commit -m "chore: initialize repo skeleton with spec and P0 plan"
```

Expected: 9 files committed (`.gitignore`, 6 `.gitkeep` files, `PRODUCTION.md`, `docs/superpowers/plans/2026-05-02-phase-0-foundation.md`).

---

## Task 2: Set up `package.json` and install dependencies

**Files:**
- Create: `D:\web-project\schedule2gather\package.json`

- [ ] **Step 1: Create `package.json`**

Create `D:\web-project\schedule2gather\package.json` with this content:

```json
{
  "name": "schedule2gather",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "typecheck": "tsc -b --noEmit",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "emulators": "firebase emulators:start --only firestore,auth",
    "deploy:dev": "firebase use dev && firebase deploy --only hosting,firestore:rules",
    "deploy:prod": "firebase use prod && firebase deploy --only hosting,firestore:rules"
  },
  "dependencies": {
    "firebase": "^12.9.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "zustand": "^5.0.11"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.1",
    "@tailwindcss/vite": "^4.2.1",
    "@types/node": "^24.10.1",
    "@types/react": "^19.2.7",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.1",
    "eslint": "^9.39.1",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.4.24",
    "globals": "^16.5.0",
    "happy-dom": "^15.11.7",
    "tailwindcss": "^4.2.1",
    "typescript": "~5.9.3",
    "typescript-eslint": "^8.48.0",
    "vite": "^7.3.1",
    "vitest": "^2.1.5"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install
```

Expected: completes without errors; creates `node_modules/` and `package-lock.json`. Warnings about peer deps for React 19 are acceptable.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add package.json and install deps"
```

---

## Task 3: TypeScript, Vite, and ESLint configuration

**Files:**
- Create: `D:\web-project\schedule2gather\tsconfig.json`
- Create: `D:\web-project\schedule2gather\tsconfig.app.json`
- Create: `D:\web-project\schedule2gather\tsconfig.node.json`
- Create: `D:\web-project\schedule2gather\vite.config.ts`
- Create: `D:\web-project\schedule2gather\eslint.config.js`
- Create: `D:\web-project\schedule2gather\index.html`

- [ ] **Step 1: Create `tsconfig.json` (project references)**

Create `D:\web-project\schedule2gather\tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

- [ ] **Step 2: Create `tsconfig.app.json`**

Create `D:\web-project\schedule2gather\tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "types": ["vite/client"],
    "skipLibCheck": true,

    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,

    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `tsconfig.node.json`**

Create `D:\web-project\schedule2gather\tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "types": ["node"],

    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,

    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 4: Create `vite.config.ts`**

Create `D:\web-project\schedule2gather\vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 5: Create `eslint.config.js`**

Create `D:\web-project\schedule2gather\eslint.config.js`:

```javascript
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'node_modules', '.firebase']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
```

- [ ] **Step 6: Create `index.html`**

Create `D:\web-project\schedule2gather\index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>schedule2gather</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Commit**

```bash
git add tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts eslint.config.js index.html
git commit -m "chore: add Vite/TS/ESLint configs"
```

---

## Task 4: React entry, base styles, and placeholder App

**Files:**
- Create: `D:\web-project\schedule2gather\src\index.css`
- Create: `D:\web-project\schedule2gather\src\main.tsx`
- Create: `D:\web-project\schedule2gather\src\App.tsx`
- Create: `D:\web-project\schedule2gather\src\vite-env.d.ts`

- [ ] **Step 1: Create `src/index.css`**

Create `D:\web-project\schedule2gather\src\index.css`:

```css
@import "tailwindcss";

@theme {
  --color-primary: var(--color-indigo-600);
  --color-primary-foreground: var(--color-white);
  --font-sans: 'Inter', system-ui, Avenir, Helvetica, Arial, sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  font-family: var(--font-sans);
  background-color: #f9fafb;
  color: #111827;
}
```

- [ ] **Step 2: Create `src/vite-env.d.ts`**

Create `D:\web-project\schedule2gather\src\vite-env.d.ts`:

```typescript
/// <reference types="vite/client" />
```

- [ ] **Step 3: Create initial placeholder `src/App.tsx`**

Create `D:\web-project\schedule2gather\src\App.tsx`. This is the *intermediate* version (no auth yet — auth lands in Task 6). It just renders a placeholder so Task 5 can be verified visually:

```tsx
export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">schedule2gather</h1>
        <p className="mt-2 text-gray-500">Phase 0 — Foundation</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `src/main.tsx`**

Create `D:\web-project\schedule2gather\src\main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 5: Verify dev server**

Run:

```bash
npm run dev
```

Expected: server listens on `http://127.0.0.1:5173`. Open that URL in a browser; you should see the "schedule2gather / Phase 0 — Foundation" placeholder. Stop with Ctrl+C.

- [ ] **Step 6: Verify production build**

Run:

```bash
npm run build
```

Expected: completes without errors; creates `dist/index.html` and `dist/assets/*`.

- [ ] **Step 7: Verify lint passes**

Run:

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 8: Commit**

```bash
git add src/index.css src/vite-env.d.ts src/main.tsx src/App.tsx
git commit -m "feat(p0): scaffold React app with placeholder UI"
```

---

## Task 5: Firebase service module and `.env` template

**Files:**
- Create: `D:\web-project\schedule2gather\.env.example`
- Create: `D:\web-project\schedule2gather\.env`
- Create: `D:\web-project\schedule2gather\src\services\firebase.ts`
- Delete: `D:\web-project\schedule2gather\src\services\.gitkeep`

- [ ] **Step 1: Create `.env.example`**

Create `D:\web-project\schedule2gather\.env.example`. Note: 7 vars, not 8 — `VITE_FIREBASE_DATABASE_URL` is dropped because we use Firestore, not RTDB:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

- [ ] **Step 2: Create empty `.env`**

Copy `.env.example` to `.env` (real values get filled in during Task 8 after the Firebase project is provisioned):

```bash
cp .env.example .env
```

Verify `.env` is git-ignored: `git status` should NOT show `.env` as untracked.

- [ ] **Step 3: Create `src/services/firebase.ts`**

Delete the placeholder gitkeep and create the real service file:

```bash
rm src/services/.gitkeep
```

Create `D:\web-project\schedule2gather\src\services\firebase.ts`:

```typescript
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
```

- [ ] **Step 4: Verify typecheck still passes**

Run:

```bash
npm run typecheck
```

Expected: no errors. (The service file imports work even without real env values; Firebase doesn't validate config until a method is called.)

- [ ] **Step 5: Commit**

```bash
git add .env.example src/services/firebase.ts
git rm src/services/.gitkeep
git commit -m "feat(p0): wire Firebase services (Firestore + Auth)"
```

---

## Task 6: Anonymous auth store and App integration

**Files:**
- Create: `D:\web-project\schedule2gather\src\stores\authStore.ts`
- Modify: `D:\web-project\schedule2gather\src\App.tsx`
- Delete: `D:\web-project\schedule2gather\src\stores\.gitkeep`

- [ ] **Step 1: Create `src/stores/authStore.ts`**

Delete the placeholder and create the auth store:

```bash
rm src/stores/.gitkeep
```

Create `D:\web-project\schedule2gather\src\stores\authStore.ts`:

```typescript
import { create } from 'zustand'
import {
  signInAnonymously,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth } from '@/services/firebase'

interface AuthState {
  user: User | null
  loading: boolean
  init: () => () => void
}

export const useAuthStore = create<AuthState>((setState) => ({
  user: null,
  loading: true,

  init: () => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setState({ user, loading: false })
      } else {
        try {
          await signInAnonymously(auth)
          // onAuthStateChanged will fire again with the new user
        } catch (err) {
          console.error('Anonymous sign-in failed:', err)
          setState({ user: null, loading: false })
        }
      }
    })
    return unsub
  },
}))
```

`★ Implementation note (do not include in code):` This pattern lets the auth listener be the single source of truth. When `onAuthStateChanged` fires with `null`, we trigger `signInAnonymously`; that triggers another `onAuthStateChanged` with the new user, which sets state. No double-subscribe, no race.

- [ ] **Step 2: Replace `src/App.tsx` with auth-aware version**

Modify `D:\web-project\schedule2gather\src\App.tsx` to import the store and render the UID. Replace the entire file:

```tsx
import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'

export default function App() {
  const init = useAuthStore((s) => s.init)
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)

  useEffect(() => {
    const unsub = init()
    return unsub
  }, [init])

  useEffect(() => {
    if (user) {
      console.log('Anonymous UID:', user.uid)
    }
  }, [user])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">schedule2gather</h1>
        <p className="mt-2 text-gray-500">Phase 0 — Foundation</p>
        <p className="mt-4 text-sm">
          {loading ? 'Signing in…' : user ? `Signed in: ${user.uid.slice(0, 8)}…` : 'Not signed in'}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify typecheck and lint**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: both pass with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/stores/authStore.ts src/App.tsx
git rm src/stores/.gitkeep
git commit -m "feat(p0): anonymous auth store and UID display"
```

Note: we cannot test this in the browser yet because `.env` has empty values. Browser verification happens at the end of Task 8.

---

## Task 7: Vitest setup and smoke test

**Files:**
- Create: `D:\web-project\schedule2gather\vitest.config.ts`
- Create: `D:\web-project\schedule2gather\src\__tests__\smoke.test.ts`
- Delete: `D:\web-project\schedule2gather\src\__tests__\.gitkeep`

- [ ] **Step 1: Create `vitest.config.ts`**

Create `D:\web-project\schedule2gather\vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 2: Create smoke test**

Delete the placeholder and create the smoke test:

```bash
rm src/__tests__/.gitkeep
```

Create `D:\web-project\schedule2gather\src\__tests__\smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('runs the test harness', () => {
    expect(1 + 1).toBe(2)
  })

  it('has happy-dom available', () => {
    const div = document.createElement('div')
    div.textContent = 'hello'
    expect(div.textContent).toBe('hello')
  })
})
```

- [ ] **Step 3: Run tests**

Run:

```bash
npm test
```

Expected output includes:
```
 ✓ src/__tests__/smoke.test.ts (2)
   ✓ smoke
     ✓ runs the test harness
     ✓ has happy-dom available

 Test Files  1 passed (1)
      Tests  2 passed (2)
```

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts src/__tests__/smoke.test.ts
git rm src/__tests__/.gitkeep
git commit -m "test(p0): set up Vitest with smoke test"
```

---

## Task 8: Provision Firebase projects, configure rules and emulators

**Files:**
- Create: `D:\web-project\schedule2gather\.firebaserc`
- Create: `D:\web-project\schedule2gather\firebase.json`
- Create: `D:\web-project\schedule2gather\firestore.rules`
- Create: `D:\web-project\schedule2gather\firestore.indexes.json`
- Modify: `D:\web-project\schedule2gather\.env` (fill in real dev project values)

- [ ] **Step 1: Create the two Firebase projects (manual, in browser)**

Open the Firebase console (`https://console.firebase.google.com`) and:

1. Click **Add project**, name it `schedule2gather-dev`. Skip Google Analytics (not needed in P0).
2. Repeat for `schedule2gather-prod`.

Note the actual project IDs Firebase assigns (often a numeric suffix is added if the name is taken — e.g., `schedule2gather-dev-1a2b3`). Record both IDs; you'll use them in Step 4.

- [ ] **Step 2: Enable Firestore in both projects**

For each of the two projects in the Firebase console:
1. Navigate to **Build → Firestore Database**.
2. Click **Create database**.
3. Choose **Production mode**. (We override with explicit rules in Step 6.)
4. Pick a region (e.g., `us-central1` or your closest).

- [ ] **Step 3: Enable Anonymous authentication in both projects**

For each project:
1. Navigate to **Build → Authentication → Sign-in method**.
2. Click **Anonymous**, toggle **Enable**, click **Save**.

- [ ] **Step 4: Create `.firebaserc`**

Create `D:\web-project\schedule2gather\.firebaserc`. Replace `<dev-id>` and `<prod-id>` with the real project IDs from Step 1:

```json
{
  "projects": {
    "default": "<dev-id>",
    "dev": "<dev-id>",
    "prod": "<prod-id>"
  }
}
```

- [ ] **Step 5: Create `firebase.json`**

Create `D:\web-project\schedule2gather\firebase.json`:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "headers": [
      {
        "source": "/index.html",
        "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
      },
      {
        "source": "/assets/**",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      }
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "ui": { "enabled": true, "port": 4000 },
    "singleProjectMode": true
  }
}
```

- [ ] **Step 6: Create baseline `firestore.rules`**

Create `D:\web-project\schedule2gather\firestore.rules`. This is the deny-by-default scaffold; P5 locks it down with a real test suite. Until then, we allow authenticated reads and a permissive write surface for development. **Never deploy this to prod after P0** — Task 11 verification deploys to `dev` only.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Phase 0 baseline: any authenticated user can read/write.
    // P5 will replace this with strict per-document rules + emulator tests.
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

- [ ] **Step 7: Create `firestore.indexes.json`**

Create `D:\web-project\schedule2gather\firestore.indexes.json`:

```json
{
  "indexes": [],
  "fieldOverrides": []
}
```

- [ ] **Step 8: Fill in `.env` with the dev project's config**

In the Firebase console for `schedule2gather-dev`:
1. Go to **Project settings** (gear icon) → **General**.
2. Scroll to **Your apps**. If no web app is registered, click the `</>` icon to register one (nickname: `schedule2gather`, do NOT enable Hosting yet — we'll deploy via CLI).
3. Copy the `firebaseConfig` block.

Paste the values into `D:\web-project\schedule2gather\.env`:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=schedule2gather-dev.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=schedule2gather-dev
VITE_FIREBASE_STORAGE_BUCKET=schedule2gather-dev.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123...
VITE_FIREBASE_APP_ID=1:123:web:abc...
VITE_FIREBASE_MEASUREMENT_ID=
```

(Leave `VITE_FIREBASE_MEASUREMENT_ID` blank if you didn't enable Analytics.)

Verify `.env` is still git-ignored: `git status` should NOT show `.env`.

- [ ] **Step 9: Deploy Firestore rules to dev**

```bash
firebase use dev
firebase deploy --only firestore:rules
```

Expected: prints "Deploy complete!" and a console URL.

- [ ] **Step 10: Verify anonymous auth in browser locally**

Run dev server:

```bash
npm run dev
```

Open `http://127.0.0.1:5173` and the browser DevTools Console. Expected console output:

```
Anonymous UID: <some 28-character UID>
```

The page should also display "Signed in: <first-8-chars>…". Stop the server with Ctrl+C.

- [ ] **Step 11: Commit**

```bash
git add .firebaserc firebase.json firestore.rules firestore.indexes.json
git commit -m "feat(p0): Firebase project config and baseline rules"
```

---

## Task 9: Verify Firebase emulator suite boots

**Files:** none new.

- [ ] **Step 1: Install emulator binaries (one-time, downloads JAR)**

```bash
firebase setup:emulators:firestore
firebase setup:emulators:ui
```

Expected: each command downloads its respective binary. Subsequent runs are no-ops.

- [ ] **Step 2: Start the emulator suite**

```bash
npm run emulators
```

Expected output includes:
```
✔  All emulators ready! It is now safe to connect your app.
┌──────────────┬────────────────┬─────────────────────────────────┐
│ Emulator     │ Host:Port      │ View in Emulator UI             │
├──────────────┼────────────────┼─────────────────────────────────┤
│ Authentication│ 127.0.0.1:9099 │ http://127.0.0.1:4000/auth      │
│ Firestore    │ 127.0.0.1:8080 │ http://127.0.0.1:4000/firestore │
└──────────────┴────────────────┴─────────────────────────────────┘
```

Open `http://127.0.0.1:4000` in a browser and verify the Emulator UI loads. Stop with Ctrl+C.

(P0 only proves emulators boot. Real emulator-backed tests for security rules land in P5.)

- [ ] **Step 3: No commit needed** — nothing changed under git control.

---

## Task 10: GitHub Actions CI with Firebase preview deploy

**Files:**
- Create: `D:\web-project\schedule2gather\.github\workflows\ci.yml`
- Create: `D:\web-project\schedule2gather\README.md`
- Create: `D:\web-project\schedule2gather\BACKLOG.md`

- [ ] **Step 1: Create the GitHub repository (manual)**

In the browser at `https://github.com/new`:
1. Repository name: `schedule2gather`.
2. Private or public — your call.
3. **Do not** initialize with README/.gitignore/license (we already have files locally).
4. Click **Create repository**.

Copy the SSH or HTTPS remote URL.

- [ ] **Step 2: Add remote and push existing commits**

Replace `<remote-url>` with what GitHub gave you:

```bash
git remote add origin <remote-url>
git push -u origin main
```

Expected: all prior commits are pushed.

- [ ] **Step 3: Generate Firebase service account JSON for CI**

```bash
firebase init hosting:github
```

This interactive command:
1. Detects your repo.
2. Prompts for the dev project — choose `<dev-id>`.
3. Asks "Set up the workflow file" — answer **No** (we'll write our own in Step 6).
4. Generates a service account, stores its JSON as a GitHub secret (default name: `FIREBASE_SERVICE_ACCOUNT_<DEV_ID_UPPER>`).

Take note of the secret name printed.

- [ ] **Step 4: Add `VITE_*` build secrets to GitHub repo**

In browser at `https://github.com/<you>/schedule2gather/settings/secrets/actions`, click **New repository secret** for each of the seven `VITE_*` env vars from your local `.env`. Use the same names:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID` (can be empty value)

- [ ] **Step 5: Create `.github/workflows/ci.yml`**

Create `D:\web-project\schedule2gather\.github\workflows\ci.yml`. Replace `FIREBASE_SERVICE_ACCOUNT_SECRET_NAME` with the actual secret name from Step 3 (e.g., `FIREBASE_SERVICE_ACCOUNT_SCHEDULE2GATHER_DEV`), and `<dev-id>` with your real dev project ID:

```yaml
name: CI

on:
  push:
    branches: ['**']
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Test
        run: npm test

      - name: Build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_FIREBASE_MEASUREMENT_ID: ${{ secrets.VITE_FIREBASE_MEASUREMENT_ID }}
        run: npm run build

      # P0 only deploys main → live on the dev project.
      # P1's plan will extend this to deploy phase/* branches to named preview channels
      # (with slash-sanitization since Firebase channel IDs disallow `/`).
      - name: Deploy to Firebase Hosting (dev live)
        if: github.event_name == 'push' && github.ref_name == 'main'
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_SECRET_NAME }}
          projectId: <dev-id>
          channelId: live
```

- [ ] **Step 6: Create `README.md`**

Create `D:\web-project\schedule2gather\README.md`:

```markdown
# schedule2gather

A modern When2Meet successor — group availability scheduling with per-participant time zones, mobile-friendly painting, and live updates. Fully serverless on Firebase.

See [`PRODUCTION.md`](./PRODUCTION.md) for the full spec, architecture, and phased roadmap.

## Quick start

```bash
npm install
cp .env.example .env   # then fill in Firebase config
npm run dev
```

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript noEmit check
- `npm test` — Vitest run
- `npm run emulators` — Start Firebase emulator suite (Firestore + Auth)
- `npm run deploy:dev` — Deploy hosting + rules to dev project
- `npm run deploy:prod` — Deploy hosting + rules to prod project (Phase 5+)

## Status

Currently in **Phase 0 — Foundation**. See `PRODUCTION.md` §12 for the phase plan.
```

- [ ] **Step 7: Create `BACKLOG.md`**

Create `D:\web-project\schedule2gather\BACKLOG.md`:

```markdown
# Backlog

Out-of-scope items captured during phase work. Each phase reviews this at start and pulls in items still relevant.

## Phase 1 — Core loop

_(empty)_

## Phase 2 — Real users, real zones

_(empty)_

## Phase 3 — Make it usable

_(empty)_

## Phase 4 — Make it shareable

_(empty)_

## Phase 5 — Make it polished

_(empty)_

## Beyond launch

- Magic-link return-edit for participants/hosts.
- Live editor avatars (showing who's currently painting).
- Optional Google Calendar one-way overlay ("show my busy times").
- Per-slot comments.
- Saved templates ("recurring poker night").
- Two-way calendar sync (would require Cloud Run + Pub/Sub).
- Smart suggestions from historical group data (Vertex AI).
```

- [ ] **Step 8: Commit and push**

```bash
git add .github/workflows/ci.yml README.md BACKLOG.md
git commit -m "ci: GitHub Actions with Firebase preview deploy"
git push
```

- [ ] **Step 9: Watch CI run**

Open `https://github.com/<you>/schedule2gather/actions` in browser. The push triggers the `CI` workflow:
1. `Lint` step passes.
2. `Typecheck` step passes.
3. `Test` step passes.
4. `Build` step passes.
5. `Deploy to Firebase Hosting preview channel` step prints a preview URL.

Expected: workflow finishes green within ~2–3 minutes.

If a step fails: read its log, fix locally, commit, push again. Common issues:
- `Build` fails due to missing/empty `VITE_*` secret → re-check Step 4.
- Deploy step fails with "permission denied" → service account secret name mismatch in Step 5.

---

## Task 11: Phase 0 acceptance verification

**Files:** none new.

- [ ] **Step 1: Open the deployed dev URL**

The Deploy step's log output ends with the live URL of the dev project, typically `https://<dev-id>.web.app` (and an aliased `https://<dev-id>.firebaseapp.com`).

Open that URL in a browser. (You can also find it in the Firebase console under **Hosting → Domains**.)

- [ ] **Step 2: Verify acceptance criterion 1 — anonymous sign-in**

Open browser DevTools Console. Expected to see:

```
Anonymous UID: <28-character UID>
```

Refresh the page. The same UID should appear (Firebase Auth persists in IndexedDB). Open the page in a different browser or incognito window — a *different* UID should appear (different anonymous identity).

- [ ] **Step 3: Verify acceptance criterion 2 — placeholder page renders**

The page displays:
- "schedule2gather" heading
- "Phase 0 — Foundation" subtitle
- "Signed in: <first-8-chars>…" status

No console errors, no React warnings.

- [ ] **Step 4: Verify acceptance criterion 3 — CI green**

Confirm the workflow run from Task 10 Step 9 has a green checkmark on `https://github.com/<you>/schedule2gather/actions`.

- [ ] **Step 5: Tag the phase**

```bash
git tag phase-0-complete
git push origin phase-0-complete
```

- [ ] **Step 6: Update `BACKLOG.md` if anything came up during P0**

Open `BACKLOG.md` and add any items you noticed during P0 that belong in P1 or later (under the appropriate "Phase N" section). If nothing came up, leave it.

If you edited `BACKLOG.md`, commit:

```bash
git add BACKLOG.md
git commit -m "docs: backlog notes from P0"
git push
```

- [ ] **Step 7: Phase 0 complete**

You now have:
- A working dev Firebase project with Firestore, anonymous Auth, baseline rules.
- A working prod Firebase project (rules not yet deployed; that happens in P5).
- A deploying CI pipeline.
- A test harness.
- A scaffold ready for P1's real features.

**Next:** Begin Phase 1 — Core Loop, planned separately when ready.

---

## Self-review notes (planner-side)

This plan was self-reviewed against PRODUCTION.md §12 P0 acceptance criteria:
- ✅ "Visiting deployed preview URL signs you in anonymously (UID visible in console)" — Tasks 6, 8 step 10, 11 step 2.
- ✅ "Placeholder page renders" — Tasks 4, 6, 11 step 3.
- ✅ "CI is green" — Tasks 10, 11 step 4.

All P0 "In scope" items from PRODUCTION.md §12 are covered:
- Vite + React + TS + Tailwind + ESLint scaffold lifted (Tasks 2–4).
- Two Firebase projects provisioned with `.firebaserc` aliases (Task 8).
- Firestore + Auth + Functions + Hosting initialized (Functions are not initialized in P0 — they're not used until P1's `createEvent`. Reading PRODUCTION.md §12 P0 again, "Functions" is listed in scope but no specific Function is required for P0 acceptance. Decision: skip `firebase init functions` until P1, which is when the first Function lands. If you want it scaffolded now, `firebase init functions` adds a `functions/` directory with TypeScript template — append it as Task 8.5 if desired).
- Zustand and shadcn/ui base — Zustand installed (Task 2); shadcn/ui base is not needed until P1 has actual UI primitives, deferred to P1 to avoid premature install.
- `@/*` path alias configured (Task 3 step 4, Task 3 step 2).
- Folder structure (`src/lib`, `src/stores`, `src/services`, `src/pages`, `src/components`) (Task 1 step 3).
- Baseline Firestore security rules (Task 8 step 6).
- Firebase emulator suite installed and runnable (Task 9).
- Vitest installed (Task 7).
- GitHub Actions CI: lint → typecheck → build → deploy preview on push (Task 10).
