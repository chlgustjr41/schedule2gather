# Phase 1 — Core Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working end-to-end app where two desktop browsers can create and join an event, paint availability with rectangle drag (single TZ, 2-state), and see each other's painted cells live via Firestore real-time listeners.

**Architecture:** Vite/React/TS/Tailwind app (P0 baseline) extended with React Router, two Zustand stores (server-state vs paint-UI-state), service layer wrapping Firebase SDK calls, and pure-logic modules in `src/lib/` (TDD'd). One Cloud Function (`createEvent`) mints unique slugs and writes event docs server-side. Participant doc updates go directly client → Firestore (no Function on the hot path). Host = participant; identity is a client-generated UUID per (event, name) stored in localStorage, with anon Firebase UID as the security context.

**Tech Stack:**
- Existing (P0): React 19, Vite 7, TS 5.9, Tailwind 4, Vitest 3, Firebase 12 SDK (Auth + Firestore), Zustand 5
- New: React Router 7, nanoid 5, react-day-picker 9, date-fns 4
- Functions runtime: Node 20, TS, firebase-functions 6+, firebase-admin 12+, gen-2 callable
- Reference: `D:\web-project\schedule2gather\docs\superpowers\specs\2026-05-03-phase-1-design.md`

**Acceptance criteria** (from design §12):
1. Two desktop browsers create + join → both paint → live aggregate updates ≤1s
2. Cell hover shows names available at slot
3. Refresh preserves name (localStorage) + bitmap (Firestore)
4. Lint, typecheck, Vitest all pass; CI green

---

## Manual prerequisites (do before Task 22)

Before CI can deploy Cloud Functions, the existing service account needs additional IAM roles. Skip this and Task 22's first push will fail at the Functions deploy step.

- [ ] **Pre-1: Add IAM roles to existing service account**
  1. Open `https://console.cloud.google.com/iam-admin/iam?project=schedule2gather`
  2. Find the service account named `github-action-<numeric-id>@schedule2gather.iam.gserviceaccount.com` (created by `firebase init hosting:github` during P0)
  3. Click the pencil icon to edit; add each of these roles:
     - **Cloud Functions Admin** (`roles/cloudfunctions.admin`)
     - **Service Account User** (`roles/iam.serviceAccountUser`)
     - **Cloud Run Admin** (`roles/run.admin`) — gen-2 functions run on Cloud Run
     - **Artifact Registry Writer** (`roles/artifactregistry.writer`) — gen-2 functions push container images
  4. Click **Save**

---

## File structure (P1 additions)

```
functions/                              (NEW directory — separate Node project)
├── package.json
├── tsconfig.json
├── .gitignore
└── src/
    ├── index.ts                       (exports createEvent HTTPS callable)
    ├── lib/
    │   ├── slug.ts                    (mintSlug; pure, TDD'd)
    │   └── validate.ts                (input validation; pure, TDD'd)
    └── __tests__/
        ├── slug.test.ts
        └── validate.test.ts

src/lib/
├── bitmap.ts                          (pack/unpack/setBit/setRectangle; TDD'd)
├── slots.ts                           (slotIndex math; TDD'd)
├── nameNormalize.ts                   (normalizeName; TDD'd)
└── participantId.ts                   (localStorage UUID management; TDD'd)

src/services/
├── eventService.ts                    (createEvent callable, subscribeToEvent)
└── participantService.ts              (subscribeToParticipants, upsertParticipant, getOrCreateParticipant)

src/stores/
├── eventStore.ts                      (server state)
└── paintStore.ts                      (paint UI state)

src/pages/
├── LandingPage.tsx                    (hosts CreateEventForm)
└── EventPage.tsx                      (orchestrates name prompt + grid)

src/components/
├── CreateEventForm.tsx
├── NamePrompt.tsx
├── AvailabilityGrid.tsx
├── CellTooltip.tsx
├── EventNotFound.tsx
└── HostBadge.tsx

src/__tests__/                          (mirrors src/lib structure)
├── bitmap.test.ts
├── slots.test.ts
├── nameNormalize.test.ts
└── participantId.test.ts

(Modified)
src/App.tsx                             (replace placeholder body with React Router)
firestore.rules                         (P1 tightened rules)
.github/workflows/firebase-hosting-merge.yml  (add Functions build + deploy steps)
package.json                            (new deps + dev:emu helper)
.env.example                            (add VITE_USE_EMULATORS line)
```

---

## Task 1: Install new dependencies + dev-emulator scaffolding

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Install new root dependencies**

```bash
cd D:/web-project/schedule2gather
npm install react-router-dom@^7 nanoid@^5 react-day-picker@^9 date-fns@^4
```

Expected: 4 packages added without errors. `package-lock.json` updates.

- [ ] **Step 2: Add `dev:emu` helper script and `predeploy` build step to `package.json`**

Read `package.json` first. In the `scripts` object, add two entries:
- After `"emulators":` line, add: `"emulators:full": "firebase emulators:start --only firestore,auth,functions",`
- After `"deploy":` line, add: `"deploy:functions": "cd functions && npm run build && cd .. && firebase deploy --only functions",`

The full `scripts` block should look like:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "typecheck": "tsc -b --noEmit",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "emulators": "firebase emulators:start --only firestore,auth",
  "emulators:full": "firebase emulators:start --only firestore,auth,functions",
  "deploy": "firebase deploy --only hosting,firestore:rules,functions",
  "deploy:functions": "cd functions && npm run build && cd .. && firebase deploy --only functions"
},
```

Note: the `deploy` script is updated to include `functions` (currently it's `hosting,firestore:rules` from P0; after this task it's `hosting,firestore:rules,functions`).

- [ ] **Step 3: Add VITE_USE_EMULATORS to `.env.example`**

Append a new line at the end of `.env.example`:

```
VITE_USE_EMULATORS=
```

(Empty by default. Devs set to `true` in `.env.local` to point the client at local emulators.)

- [ ] **Step 4: Verify lint/typecheck/test still pass**

```bash
npm run lint && npm run typecheck && npm test
```

Expected: all pass with 0 errors. The deps install doesn't introduce any code yet, so nothing should break.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "feat(p1): add router, nanoid, day-picker, date-fns; emulator scaffolding"
```

---

## Task 2: Update Firestore security rules to P1 baseline

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Replace `firestore.rules` with the P1 rules**

Read the current file first, then replace the entire contents with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /events/{eventId} {
      allow read: if true;
      allow create: if false;
      allow update, delete: if request.auth.uid == resource.data.ownerUid;

      match /participants/{participantId} {
        allow read: if true;
        allow create: if request.auth != null
                      && request.resource.data.uid == request.auth.uid
                      && request.resource.data.name is string
                      && request.resource.data.name.size() > 0
                      && request.resource.data.name.size() < 80;
        allow update: if request.auth.uid == resource.data.uid;
        allow delete: if request.auth.uid == resource.data.uid;
      }
    }
  }
}
```

- [ ] **Step 2: Deploy rules**

```bash
firebase deploy --only firestore:rules
```

Expected: "rules file firestore.rules compiled successfully" + "Deploy complete!"

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat(p1): tighten Firestore rules — events read-only client-side, participants by-uid"
```

---

## Task 3: Scaffold `functions/` directory

**Files:**
- Create: `functions/package.json`
- Create: `functions/tsconfig.json`
- Create: `functions/.gitignore`
- Create: `functions/src/index.ts` (placeholder; real handler lands in Task 10)
- Create: `functions/src/__tests__/.gitkeep`
- Create: `functions/src/lib/.gitkeep`
- Modify: `firebase.json` (add functions config)

- [ ] **Step 1: Create `functions/package.json`**

```json
{
  "name": "functions",
  "private": true,
  "type": "commonjs",
  "main": "lib/index.js",
  "engines": {
    "node": "20"
  },
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "echo 'lint runs from root via tsconfig include'",
    "serve": "npm run build && firebase emulators:start --only functions",
    "deploy": "npm run build && firebase deploy --only functions",
    "logs": "firebase functions:log"
  },
  "dependencies": {
    "firebase-admin": "^12.7.0",
    "firebase-functions": "^6.1.0",
    "nanoid": "^5.0.9"
  },
  "devDependencies": {
    "@types/node": "^20.16.0",
    "typescript": "^5.9.3",
    "vitest": "^3.2.4"
  }
}
```

Note: `"type": "commonjs"` is required by firebase-functions v6 in default mode. The root project is ESM, but functions runs CommonJS to match Firebase Functions runtime. The two are isolated Node projects so they don't conflict.

- [ ] **Step 2: Create `functions/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2022",
    "lib": ["es2022"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "outDir": "lib",
    "sourceMap": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "lib", "src/__tests__/**/*"]
}
```

Note the test files are excluded from production build but Vitest finds them anyway via its own config (next step).

- [ ] **Step 3: Create `functions/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
  },
})
```

- [ ] **Step 4: Create `functions/.gitignore`**

```
node_modules/
lib/
*.log
.firebase/
```

- [ ] **Step 5: Create placeholder `functions/src/index.ts`**

```typescript
// P1 placeholder. The createEvent handler is implemented in Task 10.
// This file is required for the firebase.json functions source path to be valid.
export {}
```

- [ ] **Step 6: Create empty placeholder dirs with `.gitkeep`**

```powershell
mkdir functions/src/__tests__, functions/src/lib -Force
New-Item functions/src/__tests__/.gitkeep, functions/src/lib/.gitkeep -ItemType File -Force
```

- [ ] **Step 7: Update `firebase.json` to register functions**

Read `firebase.json`. It currently has `hosting`, `firestore`, and `emulators` keys. Add a new `functions` array key at the top level (alongside `hosting`):

```json
"functions": [
  {
    "source": "functions",
    "codebase": "default",
    "ignore": [
      "node_modules",
      ".git",
      "firebase-debug.log",
      "firebase-debug.*.log",
      "*.local"
    ],
    "predeploy": [
      "npm --prefix \"$RESOURCE_DIR\" run build"
    ]
  }
],
```

Also update the `emulators` key to add a `functions` port:

```json
"emulators": {
  "auth": { "port": 9099 },
  "firestore": { "port": 8080 },
  "functions": { "port": 5001 },
  "ui": { "enabled": true, "port": 4000 },
  "singleProjectMode": true
}
```

- [ ] **Step 8: Install functions deps**

```bash
cd functions && npm install && cd ..
```

Expected: completes without errors. `functions/node_modules/` and `functions/package-lock.json` are created.

- [ ] **Step 9: Verify functions build**

```bash
cd functions && npm run build && cd ..
```

Expected: completes silently. `functions/lib/index.js` is created.

- [ ] **Step 10: Commit**

```bash
git add functions/package.json functions/package-lock.json functions/tsconfig.json functions/vitest.config.ts functions/.gitignore functions/src/index.ts functions/src/__tests__/.gitkeep functions/src/lib/.gitkeep firebase.json
git commit -m "feat(p1): scaffold functions/ directory (Node 20 TS, gen-2)"
```

(`functions/lib/` is git-ignored.)

---

## Task 4: TDD `src/lib/bitmap.ts`

**Files:**
- Create: `src/__tests__/bitmap.test.ts`
- Create: `src/lib/bitmap.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/__tests__/bitmap.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { pack, unpack, getBit, setBit, setRectangle } from '@/lib/bitmap'

describe('bitmap', () => {
  describe('pack / unpack roundtrip', () => {
    it('roundtrips empty array', () => {
      expect(unpack(pack([]), 0)).toEqual([])
    })

    it('roundtrips single false', () => {
      expect(unpack(pack([false]), 1)).toEqual([false])
    })

    it('roundtrips single true', () => {
      expect(unpack(pack([true]), 1)).toEqual([true])
    })

    it('roundtrips length 8 (one full byte)', () => {
      const bits = [true, false, true, false, true, false, true, false]
      expect(unpack(pack(bits), 8)).toEqual(bits)
    })

    it('roundtrips length 9 (overflows into second byte)', () => {
      const bits = [true, false, true, false, true, false, true, false, true]
      expect(unpack(pack(bits), 9)).toEqual(bits)
    })

    it('roundtrips length 63', () => {
      const bits = Array.from({ length: 63 }, (_, i) => i % 3 === 0)
      expect(unpack(pack(bits), 63)).toEqual(bits)
    })

    it('roundtrips length 8000', () => {
      const bits = Array.from({ length: 8000 }, (_, i) => i % 7 === 0)
      expect(unpack(pack(bits), 8000)).toEqual(bits)
    })

    it('uses MSB-first within byte', () => {
      // bit 0 should be at position 7 of byte 0 (i.e., MSB)
      // pack([true]) → byte[0] = 0b10000000 = 0x80 → base64('gA==')
      expect(pack([true])).toBe('gA==')
      // pack([false, true, false, false, false, false, false, false]) → 0b01000000 = 0x40 → 'QA=='
      expect(pack([false, true, false, false, false, false, false, false])).toBe('QA==')
    })
  })

  describe('getBit', () => {
    it('reads bit 0 of single-true', () => {
      expect(getBit(pack([true]), 0)).toBe(true)
    })

    it('reads bit 0 of single-false', () => {
      expect(getBit(pack([false]), 0)).toBe(false)
    })

    it('reads bits 0-8 of mixed pattern', () => {
      const bits = [true, false, true, true, false, false, false, true, true]
      const encoded = pack(bits)
      bits.forEach((expected, idx) => {
        expect(getBit(encoded, idx)).toBe(expected)
      })
    })
  })

  describe('setBit', () => {
    it('sets bit 0 to true on empty (length 1)', () => {
      const result = setBit(pack([false]), 0, true, 1)
      expect(unpack(result, 1)).toEqual([true])
    })

    it('sets bit 0 to false on existing-true', () => {
      const result = setBit(pack([true]), 0, false, 1)
      expect(unpack(result, 1)).toEqual([false])
    })

    it('sets middle bit without disturbing neighbors', () => {
      const start = [true, true, true, true, true, true, true, true, true, true]
      const result = setBit(pack(start), 5, false, 10)
      const expected = [...start]
      expected[5] = false
      expect(unpack(result, 10)).toEqual(expected)
    })

    it('sets bit across byte boundary (idx 8)', () => {
      const start = Array(16).fill(false)
      const result = setBit(pack(start), 8, true, 16)
      const expected = [...start]
      expected[8] = true
      expect(unpack(result, 16)).toEqual(expected)
    })
  })

  describe('setRectangle', () => {
    // For a 3-day × 4-slots-per-day grid (slotsPerDay=4):
    // slotIndex layout (dateIdx * slotsPerDay + timeIdx):
    //  day0: [0, 1, 2, 3]
    //  day1: [4, 5, 6, 7]
    //  day2: [8, 9, 10, 11]

    it('single cell (from === to)', () => {
      const start = Array(12).fill(false)
      const result = setRectangle(start, 5, 5, true, 4)
      const expected = [...start]
      expected[5] = true
      expect(result).toEqual(expected)
    })

    it('horizontal line within one day (from=4, to=7, day1 all slots)', () => {
      const start = Array(12).fill(false)
      const result = setRectangle(start, 4, 7, true, 4)
      const expected = [...start]
      ;[4, 5, 6, 7].forEach((i) => (expected[i] = true))
      expect(result).toEqual(expected)
    })

    it('vertical line across days (from=1 to=9, all timeIdx=1 across day0,1,2)', () => {
      const start = Array(12).fill(false)
      const result = setRectangle(start, 1, 9, true, 4)
      const expected = [...start]
      ;[1, 5, 9].forEach((i) => (expected[i] = true))
      expect(result).toEqual(expected)
    })

    it('rectangle 2x2 (from=1 to=6 → day0-day1, time1-time2)', () => {
      const start = Array(12).fill(false)
      const result = setRectangle(start, 1, 6, true, 4)
      const expected = [...start]
      ;[1, 2, 5, 6].forEach((i) => (expected[i] = true))
      expect(result).toEqual(expected)
    })

    it('rectangle handles reversed corners (from=6 to=1, same as 1 to 6)', () => {
      const start = Array(12).fill(false)
      const result = setRectangle(start, 6, 1, true, 4)
      const expected = [...start]
      ;[1, 2, 5, 6].forEach((i) => (expected[i] = true))
      expect(result).toEqual(expected)
    })

    it('full grid (from=0 to=11)', () => {
      const start = Array(12).fill(false)
      const result = setRectangle(start, 0, 11, true, 4)
      expect(result).toEqual(Array(12).fill(true))
    })

    it('clears with value=false', () => {
      const start = Array(12).fill(true)
      const result = setRectangle(start, 1, 6, false, 4)
      const expected = [...start]
      ;[1, 2, 5, 6].forEach((i) => (expected[i] = false))
      expect(result).toEqual(expected)
    })

    it('does not mutate input', () => {
      const start = Array(12).fill(false)
      const startCopy = [...start]
      setRectangle(start, 1, 6, true, 4)
      expect(start).toEqual(startCopy)
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- bitmap
```

Expected: tests fail with "Cannot find module '@/lib/bitmap'" or similar.

- [ ] **Step 3: Implement `src/lib/bitmap.ts`**

```typescript
/**
 * Pack an array of booleans into a base64-encoded bitmap.
 * MSB-first within each byte. Trailing pad bits are 0.
 */
export function pack(bits: boolean[]): string {
  const byteCount = Math.ceil(bits.length / 8)
  const bytes = new Uint8Array(byteCount)
  for (let i = 0; i < bits.length; i++) {
    if (bits[i]) {
      const byteIdx = Math.floor(i / 8)
      const bitPos = 7 - (i % 8)
      bytes[byteIdx] |= 1 << bitPos
    }
  }
  return uint8ToBase64(bytes)
}

/**
 * Unpack a base64-encoded bitmap into an array of booleans of the given length.
 */
export function unpack(encoded: string, length: number): boolean[] {
  if (length === 0) return []
  const bytes = base64ToUint8(encoded)
  const bits: boolean[] = new Array(length)
  for (let i = 0; i < length; i++) {
    const byteIdx = Math.floor(i / 8)
    const bitPos = 7 - (i % 8)
    bits[i] = (bytes[byteIdx] & (1 << bitPos)) !== 0
  }
  return bits
}

export function getBit(encoded: string, idx: number): boolean {
  const bytes = base64ToUint8(encoded)
  const byteIdx = Math.floor(idx / 8)
  const bitPos = 7 - (idx % 8)
  return (bytes[byteIdx] & (1 << bitPos)) !== 0
}

export function setBit(encoded: string, idx: number, value: boolean, length: number): string {
  const bits = unpack(encoded, length)
  bits[idx] = value
  return pack(bits)
}

/**
 * Fill a rectangle in the bit grid between fromIdx and toIdx (inclusive).
 * The rectangle spans dateIndices [min(fromDate, toDate), max(...)] and
 * timeIndices [min(fromTime, toTime), max(...)] where indices decompose as
 * dateIdx = floor(slotIdx / slotsPerDay), timeIdx = slotIdx % slotsPerDay.
 *
 * Pure: returns a new array, does not mutate `bits`.
 */
export function setRectangle(
  bits: boolean[],
  fromIdx: number,
  toIdx: number,
  value: boolean,
  slotsPerDay: number,
): boolean[] {
  const fromDate = Math.floor(fromIdx / slotsPerDay)
  const fromTime = fromIdx % slotsPerDay
  const toDate = Math.floor(toIdx / slotsPerDay)
  const toTime = toIdx % slotsPerDay

  const minDate = Math.min(fromDate, toDate)
  const maxDate = Math.max(fromDate, toDate)
  const minTime = Math.min(fromTime, toTime)
  const maxTime = Math.max(fromTime, toTime)

  const result = [...bits]
  for (let d = minDate; d <= maxDate; d++) {
    for (let t = minTime; t <= maxTime; t++) {
      result[d * slotsPerDay + t] = value
    }
  }
  return result
}

// --- internal base64 helpers ---

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToUint8(encoded: string): Uint8Array {
  if (encoded === '') return new Uint8Array(0)
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- bitmap
```

Expected: all bitmap tests pass.

- [ ] **Step 5: Run typecheck and lint**

```bash
npm run typecheck && npm run lint
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/bitmap.test.ts src/lib/bitmap.ts
git commit -m "feat(p1): bitmap pack/unpack/setRectangle with full TDD coverage"
```

---

## Task 5: TDD `src/lib/slots.ts`

**Files:**
- Create: `src/__tests__/slots.test.ts`
- Create: `src/lib/slots.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/slots.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { slotIndex, slotsPerDay, slotsPerEvent } from '@/lib/slots'

describe('slots', () => {
  describe('slotsPerDay', () => {
    it('30-minute slots from 9 to 17 → 16', () => {
      expect(slotsPerDay({ start: 9, end: 17 }, 30)).toBe(16)
    })

    it('60-minute slots from 0 to 24 → 24', () => {
      expect(slotsPerDay({ start: 0, end: 24 }, 60)).toBe(24)
    })

    it('15-minute slots from 8 to 12 → 16', () => {
      expect(slotsPerDay({ start: 8, end: 12 }, 15)).toBe(16)
    })

    it('15-minute slots single hour → 4', () => {
      expect(slotsPerDay({ start: 14, end: 15 }, 15)).toBe(4)
    })
  })

  describe('slotIndex', () => {
    it('day 0, time 0 → 0', () => {
      expect(slotIndex(0, 0, 16)).toBe(0)
    })

    it('day 0, time 5 → 5', () => {
      expect(slotIndex(0, 5, 16)).toBe(5)
    })

    it('day 1, time 0 → slotsPerDay', () => {
      expect(slotIndex(1, 0, 16)).toBe(16)
    })

    it('day 2, time 7, slotsPerDay 16 → 39', () => {
      expect(slotIndex(2, 7, 16)).toBe(39)
    })
  })

  describe('slotsPerEvent', () => {
    it('3 dates × 16 slots/day → 48', () => {
      expect(
        slotsPerEvent({
          dates: ['2026-05-05', '2026-05-06', '2026-05-07'],
          timeRange: { start: 9, end: 17 },
          slotMinutes: 30,
        }),
      ).toBe(48)
    })

    it('5 weekdays × 24 slots/day → 120', () => {
      expect(
        slotsPerEvent({
          dates: ['mon', 'tue', 'wed', 'thu', 'fri'],
          timeRange: { start: 0, end: 24 },
          slotMinutes: 60,
        }),
      ).toBe(120)
    })

    it('1 date × 4 slots/day → 4', () => {
      expect(
        slotsPerEvent({
          dates: ['2026-05-05'],
          timeRange: { start: 14, end: 15 },
          slotMinutes: 15,
        }),
      ).toBe(4)
    })
  })
})
```

- [ ] **Step 2: Run test, see it fail**

```bash
npm test -- slots
```

Expected: fails with module not found.

- [ ] **Step 3: Implement `src/lib/slots.ts`**

```typescript
export interface TimeRange {
  start: number
  end: number
}

export interface EventShape {
  dates: string[]
  timeRange: TimeRange
  slotMinutes: 15 | 30 | 60
}

/**
 * Number of time slots in a single day for the event's time range.
 */
export function slotsPerDay(timeRange: TimeRange, slotMinutes: 15 | 30 | 60): number {
  const hours = timeRange.end - timeRange.start
  return (hours * 60) / slotMinutes
}

/**
 * Flat row-major slot index: dateIdx * slotsPerDay + timeIdx.
 */
export function slotIndex(dateIdx: number, timeIdx: number, slotsPerDayCount: number): number {
  return dateIdx * slotsPerDayCount + timeIdx
}

/**
 * Total slot count across all days of an event.
 */
export function slotsPerEvent(event: EventShape): number {
  return event.dates.length * slotsPerDay(event.timeRange, event.slotMinutes)
}
```

- [ ] **Step 4: Run tests, see them pass**

```bash
npm test -- slots
```

Expected: all slots tests pass.

- [ ] **Step 5: Verify typecheck and lint**

```bash
npm run typecheck && npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/slots.test.ts src/lib/slots.ts
git commit -m "feat(p1): slot index math (slotIndex, slotsPerDay, slotsPerEvent)"
```

---

## Task 6: TDD `src/lib/nameNormalize.ts`

**Files:**
- Create: `src/__tests__/nameNormalize.test.ts`
- Create: `src/lib/nameNormalize.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/nameNormalize.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { normalizeName } from '@/lib/nameNormalize'

describe('normalizeName', () => {
  it('lowercases ASCII', () => {
    expect(normalizeName('Alice')).toBe('alice')
  })

  it('trims leading and trailing whitespace', () => {
    expect(normalizeName('  Alice  ')).toBe('alice')
  })

  it('collapses internal whitespace to single space', () => {
    expect(normalizeName('Alice    Smith')).toBe('alice smith')
  })

  it('handles tabs and newlines as whitespace', () => {
    expect(normalizeName('Alice\t\nSmith')).toBe('alice smith')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeName('   ')).toBe('')
  })

  it('handles unicode (Korean) without dropping characters', () => {
    expect(normalizeName('  최성준  ')).toBe('최성준')
  })

  it('handles mixed case unicode (German umlauts)', () => {
    expect(normalizeName('  Müller  ')).toBe('müller')
  })

  it('returns empty for empty input', () => {
    expect(normalizeName('')).toBe('')
  })
})
```

- [ ] **Step 2: Run, see fail**

```bash
npm test -- nameNormalize
```

- [ ] **Step 3: Implement `src/lib/nameNormalize.ts`**

```typescript
/**
 * Normalize a participant name for use as a localStorage key:
 * - lowercase
 * - trim leading/trailing whitespace
 * - collapse internal whitespace runs to a single space
 *
 * Preserves all unicode (does not strip non-ASCII).
 */
export function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
}
```

- [ ] **Step 4: Run, see pass**

```bash
npm test -- nameNormalize
```

- [ ] **Step 5: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/nameNormalize.test.ts src/lib/nameNormalize.ts
git commit -m "feat(p1): nameNormalize for localStorage keys"
```

---

## Task 7: TDD `src/lib/participantId.ts`

**Files:**
- Create: `src/__tests__/participantId.test.ts`
- Create: `src/lib/participantId.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/participantId.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadParticipantsForEvent,
  saveParticipantsForEvent,
  getOrCreateParticipantId,
  countNamesForEvent,
} from '@/lib/participantId'

describe('participantId', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('loadParticipantsForEvent', () => {
    it('returns empty object when no entries', () => {
      expect(loadParticipantsForEvent('abc123')).toEqual({})
    })

    it('returns parsed map when entry exists', () => {
      localStorage.setItem(
        'mg:event:abc123:participants',
        JSON.stringify({ alice: 'uuid-1', bob: 'uuid-2' }),
      )
      expect(loadParticipantsForEvent('abc123')).toEqual({ alice: 'uuid-1', bob: 'uuid-2' })
    })

    it('returns empty object on corrupted JSON', () => {
      localStorage.setItem('mg:event:abc123:participants', '{not json')
      expect(loadParticipantsForEvent('abc123')).toEqual({})
    })
  })

  describe('saveParticipantsForEvent', () => {
    it('writes JSON to the right key', () => {
      saveParticipantsForEvent('xyz789', { alice: 'uuid-1' })
      expect(localStorage.getItem('mg:event:xyz789:participants')).toBe(
        JSON.stringify({ alice: 'uuid-1' }),
      )
    })
  })

  describe('countNamesForEvent', () => {
    it('returns 0 when no entries', () => {
      expect(countNamesForEvent('abc')).toBe(0)
    })

    it('returns count when entries exist', () => {
      saveParticipantsForEvent('abc', { alice: 'u1', bob: 'u2', carol: 'u3' })
      expect(countNamesForEvent('abc')).toBe(3)
    })
  })

  describe('getOrCreateParticipantId', () => {
    it('creates a new UUID for a new name', () => {
      const id = getOrCreateParticipantId('abc', 'Alice')
      expect(id).toMatch(/^[A-Za-z0-9_-]{21}$/) // nanoid default 21 chars
    })

    it('returns the same UUID when called again with the same name', () => {
      const id1 = getOrCreateParticipantId('abc', 'Alice')
      const id2 = getOrCreateParticipantId('abc', 'Alice')
      expect(id1).toBe(id2)
    })

    it('treats names as case-insensitive (Alice and alice → same)', () => {
      const id1 = getOrCreateParticipantId('abc', 'Alice')
      const id2 = getOrCreateParticipantId('abc', 'alice')
      expect(id1).toBe(id2)
    })

    it('treats trimmed and untrimmed names as same identity', () => {
      const id1 = getOrCreateParticipantId('abc', 'Alice')
      const id2 = getOrCreateParticipantId('abc', '  Alice  ')
      expect(id1).toBe(id2)
    })

    it('different names → different UUIDs', () => {
      const id1 = getOrCreateParticipantId('abc', 'Alice')
      const id2 = getOrCreateParticipantId('abc', 'Bob')
      expect(id1).not.toBe(id2)
    })

    it('different events → independent UUID space', () => {
      const id1 = getOrCreateParticipantId('event-1', 'Alice')
      const id2 = getOrCreateParticipantId('event-2', 'Alice')
      expect(id1).not.toBe(id2)
    })
  })
})
```

- [ ] **Step 2: Run, see fail**

```bash
npm test -- participantId
```

- [ ] **Step 3: Implement `src/lib/participantId.ts`**

```typescript
import { nanoid } from 'nanoid'
import { normalizeName } from '@/lib/nameNormalize'

const KEY_PREFIX = 'mg:event:'
const KEY_SUFFIX = ':participants'

function key(slug: string): string {
  return `${KEY_PREFIX}${slug}${KEY_SUFFIX}`
}

export function loadParticipantsForEvent(slug: string): Record<string, string> {
  const raw = localStorage.getItem(key(slug))
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>
    }
    return {}
  } catch {
    return {}
  }
}

export function saveParticipantsForEvent(slug: string, map: Record<string, string>): void {
  localStorage.setItem(key(slug), JSON.stringify(map))
}

export function countNamesForEvent(slug: string): number {
  return Object.keys(loadParticipantsForEvent(slug)).length
}

/**
 * Returns the UUID for (slug, name). Creates and stores a new UUID if absent.
 * Names are normalized (lowercase + trimmed + collapsed whitespace) for keying.
 */
export function getOrCreateParticipantId(slug: string, name: string): string {
  const map = loadParticipantsForEvent(slug)
  const normalized = normalizeName(name)
  if (map[normalized]) {
    return map[normalized]
  }
  const id = nanoid()
  map[normalized] = id
  saveParticipantsForEvent(slug, map)
  return id
}
```

- [ ] **Step 4: Run, see pass**

```bash
npm test -- participantId
```

Expected: all participantId tests pass. (Vitest uses happy-dom which provides `localStorage`.)

- [ ] **Step 5: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/participantId.test.ts src/lib/participantId.ts
git commit -m "feat(p1): participantId via localStorage with normalized name keying"
```

---

## Task 8: TDD `functions/src/lib/slug.ts`

**Files:**
- Create: `functions/src/__tests__/slug.test.ts`
- Create: `functions/src/lib/slug.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/src/__tests__/slug.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { mintSlug, SLUG_ALPHABET, SLUG_LENGTH } from '../lib/slug'

describe('slug', () => {
  describe('alphabet', () => {
    it('is 32 chars with no look-alikes', () => {
      expect(SLUG_ALPHABET).toBe('abcdefghijkmnpqrstuvwxyz23456789')
      expect(SLUG_ALPHABET.length).toBe(32)
      // No 0, o, O, 1, l, I in alphabet
      ;['0', 'o', 'O', '1', 'l', 'I'].forEach((c) => {
        expect(SLUG_ALPHABET).not.toContain(c)
      })
    })
  })

  describe('SLUG_LENGTH', () => {
    it('is 6', () => {
      expect(SLUG_LENGTH).toBe(6)
    })
  })

  describe('mintSlug', () => {
    it('returns a 6-char string from the alphabet', () => {
      const slug = mintSlug()
      expect(slug.length).toBe(6)
      for (const c of slug) {
        expect(SLUG_ALPHABET).toContain(c)
      }
    })

    it('produces different slugs across many calls (sanity)', () => {
      const slugs = new Set<string>()
      for (let i = 0; i < 1000; i++) {
        slugs.add(mintSlug())
      }
      // 32^6 = ~1B; 1000 calls almost certainly all unique
      expect(slugs.size).toBe(1000)
    })
  })
})
```

- [ ] **Step 2: Run, see fail**

```bash
cd functions && npm test -- slug && cd ..
```

- [ ] **Step 3: Implement `functions/src/lib/slug.ts`**

```typescript
import { customAlphabet } from 'nanoid'

export const SLUG_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'
export const SLUG_LENGTH = 6

const generator = customAlphabet(SLUG_ALPHABET, SLUG_LENGTH)

/**
 * Mint a 6-character slug from a 32-character look-alike-free alphabet.
 * 32^6 ≈ 1 billion combinations.
 */
export function mintSlug(): string {
  return generator()
}
```

- [ ] **Step 4: Run, see pass**

```bash
cd functions && npm test -- slug && cd ..
```

- [ ] **Step 5: Verify functions build still passes**

```bash
cd functions && npm run build && cd ..
```

Expected: completes silently.

- [ ] **Step 6: Commit**

```bash
git add functions/src/__tests__/slug.test.ts functions/src/lib/slug.ts
git commit -m "feat(p1): slug minting with 32-char look-alike-free alphabet"
```

---

## Task 9: TDD `functions/src/lib/validate.ts`

**Files:**
- Create: `functions/src/__tests__/validate.test.ts`
- Create: `functions/src/lib/validate.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/src/__tests__/validate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { validateCreateEventInput, ValidationError } from '../lib/validate'

const validSpecificDates = {
  name: 'Test Event',
  mode: 'specific_dates' as const,
  dates: ['2026-05-05', '2026-05-06'],
  timeRange: { start: 9, end: 17 },
  slotMinutes: 30 as const,
  timezone: 'America/New_York',
}

const validRecurring = {
  name: 'Weekly Standup',
  mode: 'weekdays_recurring' as const,
  dates: ['mon', 'wed', 'fri'],
  timeRange: { start: 9, end: 10 },
  slotMinutes: 15 as const,
  timezone: 'UTC',
}

describe('validateCreateEventInput', () => {
  describe('valid inputs', () => {
    it('accepts specific_dates input', () => {
      expect(() => validateCreateEventInput(validSpecificDates)).not.toThrow()
    })

    it('accepts weekdays_recurring input', () => {
      expect(() => validateCreateEventInput(validRecurring)).not.toThrow()
    })

    it('accepts weekdays_in_range input', () => {
      expect(() =>
        validateCreateEventInput({
          ...validSpecificDates,
          mode: 'weekdays_in_range',
        }),
      ).not.toThrow()
    })
  })

  describe('name validation', () => {
    it('rejects empty name', () => {
      expect(() => validateCreateEventInput({ ...validSpecificDates, name: '' })).toThrow(
        ValidationError,
      )
    })

    it('rejects whitespace-only name', () => {
      expect(() => validateCreateEventInput({ ...validSpecificDates, name: '   ' })).toThrow(
        ValidationError,
      )
    })

    it('rejects name >80 chars', () => {
      expect(() =>
        validateCreateEventInput({ ...validSpecificDates, name: 'a'.repeat(81) }),
      ).toThrow(ValidationError)
    })

    it('accepts name = 80 chars', () => {
      expect(() =>
        validateCreateEventInput({ ...validSpecificDates, name: 'a'.repeat(80) }),
      ).not.toThrow()
    })

    it('rejects non-string name', () => {
      expect(() =>
        validateCreateEventInput({ ...validSpecificDates, name: 123 as unknown as string }),
      ).toThrow(ValidationError)
    })
  })

  describe('mode validation', () => {
    it('rejects unknown mode', () => {
      expect(() =>
        validateCreateEventInput({
          ...validSpecificDates,
          mode: 'unknown' as 'specific_dates',
        }),
      ).toThrow(ValidationError)
    })
  })

  describe('dates validation', () => {
    it('rejects empty dates array', () => {
      expect(() => validateCreateEventInput({ ...validSpecificDates, dates: [] })).toThrow(
        ValidationError,
      )
    })

    it('rejects > 60 dates', () => {
      const manyDates = Array.from({ length: 61 }, (_, i) => `2026-05-${String(i + 1).padStart(2, '0')}`)
      expect(() => validateCreateEventInput({ ...validSpecificDates, dates: manyDates })).toThrow(
        ValidationError,
      )
    })

    it('rejects bad date format in specific_dates', () => {
      expect(() =>
        validateCreateEventInput({ ...validSpecificDates, dates: ['not-a-date'] }),
      ).toThrow(ValidationError)
    })

    it('rejects weekday name in specific_dates', () => {
      expect(() =>
        validateCreateEventInput({ ...validSpecificDates, dates: ['mon'] }),
      ).toThrow(ValidationError)
    })

    it('rejects ISO date in weekdays_recurring', () => {
      expect(() =>
        validateCreateEventInput({ ...validRecurring, dates: ['2026-05-05'] }),
      ).toThrow(ValidationError)
    })

    it('rejects unknown weekday in weekdays_recurring', () => {
      expect(() =>
        validateCreateEventInput({ ...validRecurring, dates: ['xyz'] }),
      ).toThrow(ValidationError)
    })
  })

  describe('timeRange validation', () => {
    it('rejects start >= end', () => {
      expect(() =>
        validateCreateEventInput({ ...validSpecificDates, timeRange: { start: 10, end: 10 } }),
      ).toThrow(ValidationError)
    })

    it('rejects start < 0', () => {
      expect(() =>
        validateCreateEventInput({ ...validSpecificDates, timeRange: { start: -1, end: 17 } }),
      ).toThrow(ValidationError)
    })

    it('rejects end > 24', () => {
      expect(() =>
        validateCreateEventInput({ ...validSpecificDates, timeRange: { start: 9, end: 25 } }),
      ).toThrow(ValidationError)
    })

    it('rejects non-integer hours', () => {
      expect(() =>
        validateCreateEventInput({ ...validSpecificDates, timeRange: { start: 9.5, end: 17 } }),
      ).toThrow(ValidationError)
    })
  })

  describe('slotMinutes validation', () => {
    it('rejects 10 minutes', () => {
      expect(() =>
        validateCreateEventInput({ ...validSpecificDates, slotMinutes: 10 as 15 }),
      ).toThrow(ValidationError)
    })

    it('accepts 15, 30, 60', () => {
      ;[15, 30, 60].forEach((sm) => {
        expect(() =>
          validateCreateEventInput({ ...validSpecificDates, slotMinutes: sm as 15 | 30 | 60 }),
        ).not.toThrow()
      })
    })
  })

  describe('timezone validation', () => {
    it('rejects invalid IANA name', () => {
      expect(() =>
        validateCreateEventInput({ ...validSpecificDates, timezone: 'NotARealZone' }),
      ).toThrow(ValidationError)
    })

    it('accepts UTC', () => {
      expect(() =>
        validateCreateEventInput({ ...validSpecificDates, timezone: 'UTC' }),
      ).not.toThrow()
    })
  })

  describe('slotCount cap', () => {
    it('rejects when slotCount > 5000', () => {
      // 60 dates × 24 hours × 4 (15-min) = 5760 slots
      const manyDates = Array.from({ length: 60 }, (_, i) => `2026-05-${String((i % 28) + 1).padStart(2, '0')}`)
      expect(() =>
        validateCreateEventInput({
          ...validSpecificDates,
          dates: manyDates,
          timeRange: { start: 0, end: 24 },
          slotMinutes: 15,
        }),
      ).toThrow(ValidationError)
    })
  })
})
```

- [ ] **Step 2: Run, see fail**

```bash
cd functions && npm test -- validate && cd ..
```

- [ ] **Step 3: Implement `functions/src/lib/validate.ts`**

```typescript
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

const MODES = ['specific_dates', 'weekdays_in_range', 'weekdays_recurring'] as const
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const SLOT_MINUTES = [15, 30, 60] as const

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface CreateEventInput {
  name: string
  mode: (typeof MODES)[number]
  dates: string[]
  timeRange: { start: number; end: number }
  slotMinutes: 15 | 30 | 60
  timezone: string
}

function isInteger(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n)
}

function isValidIANATimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function validateCreateEventInput(input: unknown): asserts input is CreateEventInput {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('input must be an object')
  }
  const i = input as Record<string, unknown>

  // name
  if (typeof i.name !== 'string') {
    throw new ValidationError('name must be a string')
  }
  const trimmedName = i.name.trim()
  if (trimmedName.length === 0) {
    throw new ValidationError('name must not be empty')
  }
  if (trimmedName.length > 80) {
    throw new ValidationError('name must be 80 chars or fewer')
  }

  // mode
  if (!MODES.includes(i.mode as (typeof MODES)[number])) {
    throw new ValidationError(`mode must be one of: ${MODES.join(', ')}`)
  }
  const mode = i.mode as (typeof MODES)[number]

  // dates
  if (!Array.isArray(i.dates)) {
    throw new ValidationError('dates must be an array')
  }
  if (i.dates.length === 0) {
    throw new ValidationError('dates must not be empty')
  }
  if (i.dates.length > 60) {
    throw new ValidationError('dates must have 60 or fewer entries')
  }
  if (mode === 'weekdays_recurring') {
    for (const d of i.dates) {
      if (typeof d !== 'string' || !WEEKDAYS.includes(d as (typeof WEEKDAYS)[number])) {
        throw new ValidationError(
          `each date in weekdays_recurring mode must be one of: ${WEEKDAYS.join(', ')}`,
        )
      }
    }
  } else {
    // specific_dates or weekdays_in_range — both use ISO dates
    for (const d of i.dates) {
      if (typeof d !== 'string' || !ISO_DATE_RE.test(d)) {
        throw new ValidationError(`each date must be ISO format YYYY-MM-DD; got "${d}"`)
      }
    }
  }

  // timeRange
  if (!i.timeRange || typeof i.timeRange !== 'object') {
    throw new ValidationError('timeRange must be an object')
  }
  const tr = i.timeRange as { start?: unknown; end?: unknown }
  if (!isInteger(tr.start) || !isInteger(tr.end)) {
    throw new ValidationError('timeRange.start and end must be integers')
  }
  if (tr.start < 0 || tr.start > 23) {
    throw new ValidationError('timeRange.start must be 0-23')
  }
  if (tr.end < 1 || tr.end > 24) {
    throw new ValidationError('timeRange.end must be 1-24')
  }
  if (tr.end <= tr.start) {
    throw new ValidationError('timeRange.end must be greater than timeRange.start')
  }

  // slotMinutes
  if (!SLOT_MINUTES.includes(i.slotMinutes as (typeof SLOT_MINUTES)[number])) {
    throw new ValidationError(`slotMinutes must be one of: ${SLOT_MINUTES.join(', ')}`)
  }

  // timezone
  if (typeof i.timezone !== 'string') {
    throw new ValidationError('timezone must be a string')
  }
  if (!isValidIANATimezone(i.timezone)) {
    throw new ValidationError(`timezone "${i.timezone}" is not a valid IANA timezone`)
  }

  // slotCount cap
  const slotsPerDay = ((tr.end as number) - (tr.start as number)) * (60 / (i.slotMinutes as number))
  const slotCount = i.dates.length * slotsPerDay
  if (slotCount > 5000) {
    throw new ValidationError(`slotCount ${slotCount} exceeds cap of 5000`)
  }
}
```

- [ ] **Step 4: Run, see pass**

```bash
cd functions && npm test -- validate && cd ..
```

- [ ] **Step 5: Verify functions build**

```bash
cd functions && npm run build && cd ..
```

- [ ] **Step 6: Commit**

```bash
git add functions/src/__tests__/validate.test.ts functions/src/lib/validate.ts
git commit -m "feat(p1): createEvent input validation (all 3 modes, slotCount cap)"
```

---

## Task 10: Implement `createEvent` Cloud Function handler

**Files:**
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Replace placeholder `functions/src/index.ts` with the handler**

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { mintSlug } from './lib/slug'
import { validateCreateEventInput, ValidationError } from './lib/validate'

initializeApp()

const SLUG_RETRY_LIMIT = 5
const EXPIRY_DAYS = 90

export const createEvent = onCall(
  { region: 'us-central1' },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError('unauthenticated', 'must be authenticated')
    }

    try {
      validateCreateEventInput(req.data)
    } catch (err) {
      if (err instanceof ValidationError) {
        throw new HttpsError('invalid-argument', err.message)
      }
      throw err
    }

    const input = req.data
    const slotsPerDay = (input.timeRange.end - input.timeRange.start) * (60 / input.slotMinutes)
    const slotCount = input.dates.length * slotsPerDay

    const db = getFirestore()

    let slug: string | null = null
    for (let attempt = 0; attempt < SLUG_RETRY_LIMIT; attempt++) {
      const candidate = mintSlug()
      const snap = await db.collection('events').doc(candidate).get()
      if (!snap.exists) {
        slug = candidate
        break
      }
    }

    if (!slug) {
      throw new HttpsError('internal', 'failed to mint unique slug after retries')
    }

    const now = Timestamp.now()
    const expiresAt = Timestamp.fromMillis(now.toMillis() + EXPIRY_DAYS * 86_400_000)

    await db.collection('events').doc(slug).set({
      name: input.name.trim(),
      createdAt: now,
      expiresAt,
      ownerUid: req.auth.uid,
      mode: input.mode,
      dates: input.dates,
      timeRange: input.timeRange,
      slotMinutes: input.slotMinutes,
      timezone: input.timezone,
      slotCount,
    })

    return { slug }
  },
)
```

- [ ] **Step 2: Build the function**

```bash
cd functions && npm run build && cd ..
```

Expected: completes silently. `functions/lib/index.js` updated.

- [ ] **Step 3: Deploy the function locally for manual smoke test**

```bash
firebase deploy --only functions
```

Expected: prints "i  functions: creating Node.js 20 (2nd Gen) function createEvent(us-central1)..." then "Deploy complete!" with a function URL. The first deploy may take 90–120s; subsequent deploys are faster.

If deploy fails with "permission denied", you may need additional GCP roles on your local Firebase login. As you (the project owner) you should have full rights — if you see this, double-check `firebase use` shows `schedule2gather`.

- [ ] **Step 4: Manually invoke the function to verify**

In a fresh terminal, run a small Node script to call the function. Save this as `scripts/test-create-event.mjs` (DO NOT commit this script — it's just for manual verification):

```javascript
// scripts/test-create-event.mjs
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'
import 'dotenv/config'

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
})

await signInAnonymously(getAuth(app))
const callable = httpsCallable(getFunctions(app, 'us-central1'), 'createEvent')

const result = await callable({
  name: 'Manual Smoke Test',
  mode: 'specific_dates',
  dates: ['2026-05-05', '2026-05-06'],
  timeRange: { start: 9, end: 17 },
  slotMinutes: 30,
  timezone: 'America/New_York',
})

console.log('result:', result.data)
```

Run with `node --env-file=.env scripts/test-create-event.mjs`. Expected: prints `result: { slug: 'abc234' }` (some 6-char slug). Then verify in Firebase Console (Firestore → events) that the doc was created.

If this works, delete `scripts/test-create-event.mjs` and the (likely empty) `scripts/` directory:

```powershell
Remove-Item scripts/test-create-event.mjs -Force
Remove-Item scripts -Force -Recurse
```

- [ ] **Step 5: Commit (the function code, not the smoke test script)**

```bash
git add functions/src/index.ts
git commit -m "feat(p1): createEvent Cloud Function (slug mint, retry, validate, write event doc)"
```

---

## Task 11: Implement `src/services/eventService.ts`

**Files:**
- Create: `src/services/eventService.ts`

- [ ] **Step 1: Create the service**

```typescript
import { httpsCallable, getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions'
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { app, db } from '@/services/firebase'

let functionsInstance: Functions | null = null

function getFunctionsClient(): Functions {
  if (functionsInstance) return functionsInstance
  functionsInstance = getFunctions(app, 'us-central1')
  if (import.meta.env.VITE_USE_EMULATORS === 'true') {
    connectFunctionsEmulator(functionsInstance, '127.0.0.1', 5001)
  }
  return functionsInstance
}

export interface CreateEventInput {
  name: string
  mode: 'specific_dates' | 'weekdays_in_range' | 'weekdays_recurring'
  dates: string[]
  timeRange: { start: number; end: number }
  slotMinutes: 15 | 30 | 60
  timezone: string
}

export interface CreateEventResult {
  slug: string
}

/**
 * Calls the createEvent Cloud Function. Throws on validation errors or network failures.
 */
export async function createEvent(input: CreateEventInput): Promise<CreateEventResult> {
  const callable = httpsCallable<CreateEventInput, CreateEventResult>(getFunctionsClient(), 'createEvent')
  const result = await callable(input)
  return result.data
}

export interface EventDoc {
  name: string
  createdAt: { seconds: number; nanoseconds: number }
  expiresAt: { seconds: number; nanoseconds: number }
  ownerUid: string
  mode: 'specific_dates' | 'weekdays_in_range' | 'weekdays_recurring'
  dates: string[]
  timeRange: { start: number; end: number }
  slotMinutes: 15 | 30 | 60
  timezone: string
  slotCount: number
}

/**
 * Subscribe to live updates of an event doc. Calls cb with the doc data, or null if not found.
 * Returns the unsubscribe function.
 */
export function subscribeToEvent(slug: string, cb: (event: EventDoc | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'events', slug), (snap) => {
    cb(snap.exists() ? (snap.data() as EventDoc) : null)
  })
}
```

- [ ] **Step 2: Verify typecheck and lint**

```bash
npm run typecheck && npm run lint
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/eventService.ts
git commit -m "feat(p1): eventService (createEvent callable, subscribeToEvent)"
```

---

## Task 12: Implement `src/services/participantService.ts`

**Files:**
- Create: `src/services/participantService.ts`

- [ ] **Step 1: Create the service**

```typescript
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { getOrCreateParticipantId } from '@/lib/participantId'

export interface ParticipantDoc {
  participantId: string
  name: string
  uid: string
  availability: string
  lastUpdated: { seconds: number; nanoseconds: number }
}

/**
 * Subscribe to live updates of all participants for an event.
 */
export function subscribeToParticipants(
  slug: string,
  cb: (participants: ParticipantDoc[]) => void,
): Unsubscribe {
  const ref = collection(db, 'events', slug, 'participants')
  return onSnapshot(ref, (snap) => {
    const list = snap.docs.map((d) => d.data() as ParticipantDoc)
    cb(list)
  })
}

/**
 * Resolve or create the local participant for this (event, name).
 * Creates the Firestore doc if absent.
 */
export async function getOrCreateParticipant(
  slug: string,
  name: string,
  uid: string,
): Promise<ParticipantDoc> {
  const participantId = getOrCreateParticipantId(slug, name)
  const ref = doc(db, 'events', slug, 'participants', participantId)
  const initial: Omit<ParticipantDoc, 'lastUpdated'> = {
    participantId,
    name: name.trim(),
    uid,
    availability: '',
  }
  // Use merge:true so re-creating a participant by the same name doesn't blow away an existing bitmap.
  await setDoc(
    ref,
    { ...initial, lastUpdated: serverTimestamp() },
    { merge: true },
  )
  // Round-trip: build optimistic doc to return immediately. The real one arrives via subscribeToParticipants.
  return {
    ...initial,
    lastUpdated: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
  }
}

/**
 * Update a participant's availability bitmap.
 */
export async function updateAvailability(
  slug: string,
  participantId: string,
  availability: string,
): Promise<void> {
  const ref = doc(db, 'events', slug, 'participants', participantId)
  await setDoc(ref, { availability, lastUpdated: serverTimestamp() }, { merge: true })
}
```

- [ ] **Step 2: Verify typecheck and lint**

```bash
npm run typecheck && npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/services/participantService.ts
git commit -m "feat(p1): participantService (subscribe, getOrCreate, updateAvailability)"
```

---

## Task 13: Implement `src/stores/eventStore.ts`

**Files:**
- Create: `src/stores/eventStore.ts`

- [ ] **Step 1: Create the store**

```typescript
import { create } from 'zustand'
import { subscribeToEvent, type EventDoc } from '@/services/eventService'
import {
  subscribeToParticipants,
  getOrCreateParticipant,
  updateAvailability,
  type ParticipantDoc,
} from '@/services/participantService'

interface EventState {
  slug: string | null
  event: EventDoc | null
  myParticipant: ParticipantDoc | null
  participants: ParticipantDoc[]
  loading: boolean
  notFound: boolean

  // internal: unsubscribe handles
  _eventUnsub: (() => void) | null
  _participantsUnsub: (() => void) | null

  loadEvent: (slug: string) => void
  joinAs: (name: string, uid: string) => Promise<void>
  updateMyAvailability: (availability: string) => Promise<void>
  reset: () => void
}

export const useEventStore = create<EventState>((set, get) => ({
  slug: null,
  event: null,
  myParticipant: null,
  participants: [],
  loading: true,
  notFound: false,
  _eventUnsub: null,
  _participantsUnsub: null,

  loadEvent: (slug) => {
    const state = get()
    // Tear down prior subscriptions
    state._eventUnsub?.()
    state._participantsUnsub?.()

    set({
      slug,
      event: null,
      myParticipant: null,
      participants: [],
      loading: true,
      notFound: false,
    })

    let firstEventSnap = true
    const eventUnsub = subscribeToEvent(slug, (event) => {
      if (event === null) {
        set({ event: null, notFound: true, loading: false })
      } else {
        set({ event, notFound: false, loading: false })
      }
      if (firstEventSnap) {
        firstEventSnap = false
      }
    })

    const participantsUnsub = subscribeToParticipants(slug, (participants) => {
      set({ participants })
      // Update myParticipant from the live list if we have one
      const current = get().myParticipant
      if (current) {
        const fresh = participants.find((p) => p.participantId === current.participantId)
        if (fresh) {
          set({ myParticipant: fresh })
        }
      }
    })

    set({ _eventUnsub: eventUnsub, _participantsUnsub: participantsUnsub })
  },

  joinAs: async (name, uid) => {
    const state = get()
    if (!state.slug) throw new Error('joinAs called before loadEvent')
    const participant = await getOrCreateParticipant(state.slug, name, uid)
    set({ myParticipant: participant })
  },

  updateMyAvailability: async (availability) => {
    const state = get()
    if (!state.slug || !state.myParticipant) {
      throw new Error('updateMyAvailability called without slug + myParticipant')
    }
    // Optimistic local update
    set({ myParticipant: { ...state.myParticipant, availability } })
    await updateAvailability(state.slug, state.myParticipant.participantId, availability)
  },

  reset: () => {
    const state = get()
    state._eventUnsub?.()
    state._participantsUnsub?.()
    set({
      slug: null,
      event: null,
      myParticipant: null,
      participants: [],
      loading: true,
      notFound: false,
      _eventUnsub: null,
      _participantsUnsub: null,
    })
  },
}))
```

- [ ] **Step 2: Verify typecheck and lint**

```bash
npm run typecheck && npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/stores/eventStore.ts
git commit -m "feat(p1): eventStore (server state with onSnapshot subscriptions)"
```

---

## Task 14: Implement `src/stores/paintStore.ts`

**Files:**
- Create: `src/stores/paintStore.ts`

- [ ] **Step 1: Create the store**

```typescript
import { create } from 'zustand'
import { setRectangle } from '@/lib/bitmap'

interface PaintState {
  origin: number | null
  current: number | null
  draftBits: boolean[] | null
  /** "on" means the drag is filling cells true; "off" means clearing. Null when not painting. */
  mode: 'on' | 'off' | null

  startPaint: (slotIdx: number, currentBits: boolean[]) => void
  dragTo: (slotIdx: number, currentBits: boolean[], slotsPerDay: number) => void
  commitPaint: () => boolean[] | null
}

export const usePaintStore = create<PaintState>((set, get) => ({
  origin: null,
  current: null,
  draftBits: null,
  mode: null,

  startPaint: (slotIdx, currentBits) => {
    const startState = currentBits[slotIdx] ?? false
    // Paint-by-example: drag turns cells to the OPPOSITE of the start cell's state.
    const mode: 'on' | 'off' = startState ? 'off' : 'on'
    set({
      origin: slotIdx,
      current: slotIdx,
      mode,
      // Initial draft is currentBits with the start cell flipped to mode
      draftBits: applyAt(currentBits, slotIdx, slotIdx, mode === 'on', 1),
    })
  },

  dragTo: (slotIdx, currentBits, slotsPerDay) => {
    const state = get()
    if (state.origin === null || state.mode === null) return
    const value = state.mode === 'on'
    const draftBits = setRectangle(currentBits, state.origin, slotIdx, value, slotsPerDay)
    set({ current: slotIdx, draftBits })
  },

  commitPaint: () => {
    const state = get()
    const draft = state.draftBits
    set({ origin: null, current: null, draftBits: null, mode: null })
    return draft
  },
}))

// Used only for the single-cell start case; otherwise we go through setRectangle in dragTo.
function applyAt(bits: boolean[], from: number, to: number, value: boolean, slotsPerDay: number): boolean[] {
  return setRectangle(bits, from, to, value, slotsPerDay)
}
```

- [ ] **Step 2: Verify typecheck and lint**

```bash
npm run typecheck && npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/stores/paintStore.ts
git commit -m "feat(p1): paintStore (paint-by-example drag state)"
```

---

## Task 15: Add React Router and create page shells

**Files:**
- Modify: `src/App.tsx`
- Create: `src/pages/LandingPage.tsx`
- Create: `src/pages/EventPage.tsx`
- Delete: `src/pages/.gitkeep`

- [ ] **Step 1: Delete the placeholder gitkeep**

```bash
rm src/pages/.gitkeep
```

- [ ] **Step 2: Create `src/pages/LandingPage.tsx`** (placeholder; CreateEventForm wired in Task 16)

```tsx
export default function LandingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">schedule2gather</h1>
        <p className="mt-4 text-gray-500">Create an event to find a meeting time with your group.</p>
        <p className="mt-8 text-sm text-gray-400">Phase 1 — form lands in next task</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/pages/EventPage.tsx`** (placeholder; orchestration wired in Tasks 17–22)

```tsx
import { useParams } from 'react-router-dom'

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>()
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Event {slug}</h1>
        <p className="mt-4 text-sm text-gray-400">Phase 1 — grid lands in next tasks</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Replace `src/App.tsx` with router-based version**

Read the current `App.tsx` (it has the auth init + UID display from P0). Replace the entire contents with:

```tsx
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import LandingPage from '@/pages/LandingPage'
import EventPage from '@/pages/EventPage'

export default function App() {
  const init = useAuthStore((s) => s.init)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    const unsub = init()
    return unsub
  }, [init])

  useEffect(() => {
    if (user) {
      // TODO(p1): remove — needed for P0 acceptance only
      console.log('Anonymous UID:', user.uid)
    }
  }, [user])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/e/:slug" element={<EventPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 5: Verify dev server boots and renders both pages**

Run:

```bash
npm run dev
```

Open `http://127.0.0.1:5173/` (or whatever port Vite picks). Confirm landing page shows "schedule2gather". Then navigate to `http://127.0.0.1:5173/e/abc123`; confirm "Event abc123" placeholder shows. Stop the server.

- [ ] **Step 6: Verify lint, typecheck, test**

```bash
npm run lint && npm run typecheck && npm test
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/pages/LandingPage.tsx src/pages/EventPage.tsx
git rm src/pages/.gitkeep
git commit -m "feat(p1): React Router + LandingPage and EventPage shells"
```

---

## Task 16: Implement `CreateEventForm`

**Files:**
- Create: `src/components/CreateEventForm.tsx`
- Modify: `src/pages/LandingPage.tsx`
- Delete: `src/components/.gitkeep`

- [ ] **Step 1: Delete the placeholder gitkeep**

```bash
rm src/components/.gitkeep
```

- [ ] **Step 2: Create `src/components/CreateEventForm.tsx`**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { format, eachDayOfInterval, getDay } from 'date-fns'
import { createEvent, type CreateEventInput } from '@/services/eventService'

type Tab = 'specific' | 'weekdays'
type WeekdaySubmode = 'recurring' | 'in_range'
const WEEKDAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export default function CreateEventForm() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('specific')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Common fields
  const [name, setName] = useState('')
  const [startHour, setStartHour] = useState(9)
  const [endHour, setEndHour] = useState(17)
  const [slotMinutes, setSlotMinutes] = useState<15 | 30 | 60>(30)
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)

  // Specific dates
  const [selectedDates, setSelectedDates] = useState<Date[]>([])

  // Weekdays
  const [weekdaySubmode, setWeekdaySubmode] = useState<WeekdaySubmode>('recurring')
  const [selectedWeekdays, setSelectedWeekdays] = useState<Set<string>>(new Set(['mon', 'wed', 'fri']))
  const [rangeFrom, setRangeFrom] = useState<Date | undefined>(undefined)
  const [rangeTo, setRangeTo] = useState<Date | undefined>(undefined)

  const toggleWeekday = (w: string) => {
    setSelectedWeekdays((prev) => {
      const next = new Set(prev)
      if (next.has(w)) next.delete(w)
      else next.add(w)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      let input: CreateEventInput

      if (tab === 'specific') {
        if (selectedDates.length === 0) {
          throw new Error('Pick at least one date')
        }
        const dates = [...selectedDates]
          .sort((a, b) => a.getTime() - b.getTime())
          .map((d) => format(d, 'yyyy-MM-dd'))
        input = {
          name,
          mode: 'specific_dates',
          dates,
          timeRange: { start: startHour, end: endHour },
          slotMinutes,
          timezone,
        }
      } else if (weekdaySubmode === 'recurring') {
        if (selectedWeekdays.size === 0) {
          throw new Error('Pick at least one weekday')
        }
        const dates = WEEKDAY_NAMES.filter((w) => selectedWeekdays.has(w))
        input = {
          name,
          mode: 'weekdays_recurring',
          dates,
          timeRange: { start: startHour, end: endHour },
          slotMinutes,
          timezone,
        }
      } else {
        // weekdays_in_range
        if (!rangeFrom || !rangeTo) {
          throw new Error('Pick a date range')
        }
        if (selectedWeekdays.size === 0) {
          throw new Error('Pick at least one weekday')
        }
        const allDates = eachDayOfInterval({ start: rangeFrom, end: rangeTo })
        const dates = allDates
          .filter((d) => selectedWeekdays.has(WEEKDAY_NAMES[getDay(d)]))
          .map((d) => format(d, 'yyyy-MM-dd'))
        if (dates.length === 0) {
          throw new Error('No dates match those weekdays in the chosen range')
        }
        input = {
          name,
          mode: 'weekdays_in_range',
          dates,
          timeRange: { start: startHour, end: endHour },
          slotMinutes,
          timezone,
        }
      }

      const { slug } = await createEvent(input)
      navigate(`/e/${slug}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto p-6 space-y-6">
      <div>
        <label className="block text-sm font-medium">Event name</label>
        <input
          type="text"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full border rounded px-3 py-2"
          placeholder="Team standup"
        />
      </div>

      <div className="flex gap-2 border-b">
        <button
          type="button"
          onClick={() => setTab('specific')}
          className={`px-4 py-2 ${tab === 'specific' ? 'border-b-2 border-indigo-600 font-medium' : 'text-gray-500'}`}
        >
          Specific dates
        </button>
        <button
          type="button"
          onClick={() => setTab('weekdays')}
          className={`px-4 py-2 ${tab === 'weekdays' ? 'border-b-2 border-indigo-600 font-medium' : 'text-gray-500'}`}
        >
          Days of week
        </button>
      </div>

      {tab === 'specific' && (
        <div>
          <label className="block text-sm font-medium mb-2">Pick dates</label>
          <DayPicker
            mode="multiple"
            selected={selectedDates}
            onSelect={(dates) => setSelectedDates(dates ?? [])}
          />
          <p className="mt-2 text-sm text-gray-500">{selectedDates.length} selected</p>
        </div>
      )}

      {tab === 'weekdays' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={weekdaySubmode === 'recurring'}
                onChange={() => setWeekdaySubmode('recurring')}
              />
              Recurring (no dates)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={weekdaySubmode === 'in_range'}
                onChange={() => setWeekdaySubmode('in_range')}
              />
              Within date range
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Pick weekdays</label>
            <div className="flex gap-2 flex-wrap">
              {WEEKDAY_NAMES.map((w) => (
                <label key={w} className="flex items-center gap-1 px-3 py-1 border rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedWeekdays.has(w)}
                    onChange={() => toggleWeekday(w)}
                  />
                  {w.toUpperCase()}
                </label>
              ))}
            </div>
          </div>

          {weekdaySubmode === 'in_range' && (
            <div>
              <label className="block text-sm font-medium mb-2">Date range</label>
              <DayPicker
                mode="range"
                selected={{ from: rangeFrom, to: rangeTo }}
                onSelect={(range) => {
                  setRangeFrom(range?.from)
                  setRangeTo(range?.to)
                }}
              />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Start hour</label>
          <input
            type="number"
            min={0}
            max={23}
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
            className="mt-1 w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">End hour</label>
          <input
            type="number"
            min={1}
            max={24}
            value={endHour}
            onChange={(e) => setEndHour(Number(e.target.value))}
            className="mt-1 w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Slot size</label>
        <select
          value={slotMinutes}
          onChange={(e) => setSlotMinutes(Number(e.target.value) as 15 | 30 | 60)}
          className="mt-1 w-full border rounded px-3 py-2"
        >
          <option value={15}>15 minutes</option>
          <option value={30}>30 minutes</option>
          <option value={60}>1 hour</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Time zone</label>
        <input
          type="text"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="mt-1 w-full border rounded px-3 py-2"
          placeholder="America/New_York"
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-indigo-600 text-white py-3 rounded font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        {submitting ? 'Creating…' : 'Create event'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Wire it into LandingPage**

Replace `src/pages/LandingPage.tsx` contents with:

```tsx
import CreateEventForm from '@/components/CreateEventForm'

export default function LandingPage() {
  return (
    <div className="min-h-screen py-8">
      <h1 className="text-3xl font-semibold text-center">schedule2gather</h1>
      <p className="text-center text-gray-500 mt-2">Find a time to meet, fast.</p>
      <CreateEventForm />
    </div>
  )
}
```

- [ ] **Step 4: Manual smoke test**

Run `npm run dev`. Submit the form with valid inputs (e.g., name "Test", select 2 dates, 9–17, 30 min, your TZ). Expected: form submits, you're redirected to `/e/{slug}` (placeholder page from Task 15). Check Firestore Console — event doc should exist. Stop the server.

If the call fails with "permission denied" or "function not deployed", verify Task 10 was completed and the function is live.

- [ ] **Step 5: Lint, typecheck, test**

```bash
npm run lint && npm run typecheck && npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/components/CreateEventForm.tsx src/pages/LandingPage.tsx
git rm src/components/.gitkeep
git commit -m "feat(p1): CreateEventForm with both modes and weekdays sub-toggle"
```

---

## Task 17: Implement `NamePrompt`

**Files:**
- Create: `src/components/NamePrompt.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState } from 'react'

interface NamePromptProps {
  /** Optional: prior names found in localStorage for this event. Empty array = no prior names. */
  priorNames: string[]
  onSubmit: (name: string) => void
}

export default function NamePrompt({ priorNames, onSubmit }: NamePromptProps) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length === 0) return
    setSubmitting(true)
    try {
      onSubmit(trimmed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <form onSubmit={handle} className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
        <h2 className="text-xl font-semibold mb-3">Enter your name</h2>
        {priorNames.length > 0 && (
          <p className="text-sm text-gray-500 mb-3">
            Prior names on this device:{' '}
            {priorNames.map((n, i) => (
              <span key={n}>
                <button
                  type="button"
                  onClick={() => setName(n)}
                  className="underline text-indigo-600"
                >
                  {n}
                </button>
                {i < priorNames.length - 1 ? ', ' : ''}
              </span>
            ))}
          </p>
        )}
        <input
          type="text"
          autoFocus
          required
          maxLength={79}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded px-3 py-2"
          placeholder="Alice"
        />
        <button
          type="submit"
          disabled={submitting || name.trim().length === 0}
          className="mt-4 w-full bg-indigo-600 text-white py-2 rounded font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? 'Joining…' : 'Join'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Lint, typecheck**

```bash
npm run lint && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/components/NamePrompt.tsx
git commit -m "feat(p1): NamePrompt modal with prior-names hint"
```

---

## Task 18: Implement `AvailabilityGrid` (the centerpiece)

**Files:**
- Create: `src/components/AvailabilityGrid.tsx`

- [ ] **Step 1: Create the grid component**

```tsx
import { useMemo, useState } from 'react'
import { useEventStore } from '@/stores/eventStore'
import { usePaintStore } from '@/stores/paintStore'
import { pack, unpack } from '@/lib/bitmap'
import { slotsPerDay } from '@/lib/slots'
import CellTooltip from '@/components/CellTooltip'

const WEEKDAY_LABELS: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
}

function formatDateLabel(dateStr: string, mode: string): string {
  if (mode === 'weekdays_recurring') {
    return WEEKDAY_LABELS[dateStr] ?? dateStr
  }
  // ISO date → "May 5"
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatTimeLabel(timeIdx: number, startHour: number, slotMinutes: number): string {
  const totalMins = startHour * 60 + timeIdx * slotMinutes
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function AvailabilityGrid() {
  const { event, myParticipant, participants, updateMyAvailability } = useEventStore()
  const { startPaint, dragTo, commitPaint, draftBits } = usePaintStore()
  const [tooltipSlot, setTooltipSlot] = useState<number | null>(null)

  const spd = useMemo(
    () => (event ? slotsPerDay(event.timeRange, event.slotMinutes) : 0),
    [event],
  )

  const myCommittedBits = useMemo(() => {
    if (!event || !myParticipant) return null
    return unpack(myParticipant.availability, event.slotCount)
  }, [event, myParticipant])

  // Aggregate counts per slot (from all participants except myself, plus my live draft if dragging)
  const aggregateCounts = useMemo(() => {
    if (!event) return []
    const counts = new Array(event.slotCount).fill(0)
    for (const p of participants) {
      const bits = unpack(p.availability, event.slotCount)
      for (let i = 0; i < event.slotCount; i++) {
        if (bits[i]) counts[i] += 1
      }
    }
    // If I'm dragging, swap my committed bits for draft bits in the count
    if (draftBits && myParticipant) {
      const myBits = unpack(myParticipant.availability, event.slotCount)
      for (let i = 0; i < event.slotCount; i++) {
        if (myBits[i] && !draftBits[i]) counts[i] -= 1
        else if (!myBits[i] && draftBits[i]) counts[i] += 1
      }
    }
    return counts
  }, [event, participants, draftBits, myParticipant])

  if (!event || !myParticipant || !myCommittedBits) {
    return <div className="text-center text-gray-500">Loading event…</div>
  }

  const myDisplayBits = draftBits ?? myCommittedBits

  const handlePointerDown = (slotIdx: number) => (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    startPaint(slotIdx, myCommittedBits)
  }

  const handlePointerEnter = (slotIdx: number) => () => {
    if (draftBits) {
      dragTo(slotIdx, myCommittedBits, spd)
    } else {
      setTooltipSlot(slotIdx)
    }
  }

  const handlePointerLeave = () => {
    if (!draftBits) setTooltipSlot(null)
  }

  const handlePointerUp = async () => {
    const finalBits = commitPaint()
    if (finalBits) {
      await updateMyAvailability(pack(finalBits))
    }
  }

  return (
    <div className="overflow-auto p-4">
      <table
        className="border-collapse select-none"
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <thead>
          <tr>
            <th className="w-20"></th>
            {event.dates.map((d) => (
              <th key={d} className="p-2 text-sm font-medium">
                {formatDateLabel(d, event.mode)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: spd }).map((_, timeIdx) => (
            <tr key={timeIdx}>
              <td className="text-xs text-gray-500 pr-2 align-top">
                {formatTimeLabel(timeIdx, event.timeRange.start, event.slotMinutes)}
              </td>
              {event.dates.map((_d, dateIdx) => {
                const slotIdx = dateIdx * spd + timeIdx
                const mine = myDisplayBits[slotIdx]
                const count = aggregateCounts[slotIdx]
                const intensity = participants.length > 0 ? count / participants.length : 0
                const bg = mine
                  ? '#4f46e5' // indigo-600 for my own
                  : `rgba(34, 197, 94, ${0.15 + intensity * 0.6})` // green tint by aggregate
                return (
                  <td
                    key={slotIdx}
                    onPointerDown={handlePointerDown(slotIdx)}
                    onPointerEnter={handlePointerEnter(slotIdx)}
                    onPointerLeave={handlePointerLeave}
                    style={{ backgroundColor: bg }}
                    className="w-12 h-6 border border-gray-200 cursor-pointer relative"
                  >
                    {tooltipSlot === slotIdx && !draftBits && (
                      <CellTooltip
                        names={participants.filter((p) => unpack(p.availability, event.slotCount)[slotIdx]).map((p) => p.name)}
                      />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Lint and typecheck (will fail until CellTooltip exists in Task 19; expected)**

```bash
npm run typecheck
```

Expected: error "Cannot find module '@/components/CellTooltip'" — that's fine, lands in next task.

- [ ] **Step 3: Commit (yes, with the broken import; Task 19 fixes it immediately)**

```bash
git add src/components/AvailabilityGrid.tsx
git commit -m "feat(p1): AvailabilityGrid (paint engine + heatmap; CellTooltip pending)"
```

---

## Task 19: Implement `CellTooltip`

**Files:**
- Create: `src/components/CellTooltip.tsx`

- [ ] **Step 1: Create the component**

```tsx
interface CellTooltipProps {
  names: string[]
}

export default function CellTooltip({ names }: CellTooltipProps) {
  return (
    <div className="absolute z-30 left-full top-0 ml-2 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap pointer-events-none">
      {names.length === 0 ? (
        <span className="text-gray-400">No one available</span>
      ) : (
        <ul>
          {names.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck and lint now pass**

```bash
npm run lint && npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CellTooltip.tsx
git commit -m "feat(p1): CellTooltip — names-available list on hover"
```

---

## Task 20: Implement `EventNotFound`

**Files:**
- Create: `src/components/EventNotFound.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { Link } from 'react-router-dom'

export default function EventNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Event not found</h1>
        <p className="mt-2 text-gray-500">This event link is invalid or has expired.</p>
        <Link to="/" className="mt-6 inline-block text-indigo-600 underline">
          Create a new event
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Lint and typecheck**

```bash
npm run lint && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/components/EventNotFound.tsx
git commit -m "feat(p1): EventNotFound view"
```

---

## Task 21: Implement `HostBadge` and wire EventPage orchestration

**Files:**
- Create: `src/components/HostBadge.tsx`
- Modify: `src/pages/EventPage.tsx`

- [ ] **Step 1: Create `HostBadge`**

```tsx
export default function HostBadge() {
  return (
    <span className="inline-block bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded">
      You created this event
    </span>
  )
}
```

- [ ] **Step 2: Replace `EventPage.tsx` with the full orchestration**

```tsx
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useEventStore } from '@/stores/eventStore'
import { useAuthStore } from '@/stores/authStore'
import { loadParticipantsForEvent, countNamesForEvent } from '@/lib/participantId'
import NamePrompt from '@/components/NamePrompt'
import AvailabilityGrid from '@/components/AvailabilityGrid'
import EventNotFound from '@/components/EventNotFound'
import HostBadge from '@/components/HostBadge'

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>()
  const user = useAuthStore((s) => s.user)
  const { event, myParticipant, loading, notFound, loadEvent, joinAs, reset } = useEventStore()
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [priorNames, setPriorNames] = useState<string[]>([])

  // Load event when route enters
  useEffect(() => {
    if (!slug) return
    loadEvent(slug)
    return () => reset()
  }, [slug, loadEvent, reset])

  // After event loaded, decide auto-join vs prompt
  useEffect(() => {
    if (!slug || !event || !user || myParticipant) return
    const map = loadParticipantsForEvent(slug)
    const entries = Object.entries(map)
    if (entries.length === 1) {
      // Auto-join with the one prior name
      const [normalizedName] = entries[0]
      // We stored raw names in joinAs; here we just re-pass the normalized as the name (user can rename in P2)
      void joinAs(normalizedName, user.uid)
    } else {
      // Show prompt; pass prior names as hints
      setPriorNames(entries.map(([n]) => n))
      setShowNamePrompt(true)
    }
  }, [slug, event, user, myParticipant, joinAs])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading event…</div>
  }

  if (notFound || !event) {
    return <EventNotFound />
  }

  const isHost = user?.uid === event.ownerUid

  const handleJoin = async (name: string) => {
    if (!slug || !user) return
    await joinAs(name, user.uid)
    setShowNamePrompt(false)
    setPriorNames([])
    // Refresh prior-names count for any future case where user wants to switch identity
    countNamesForEvent(slug)
  }

  return (
    <div className="min-h-screen p-4">
      <div className="flex items-center justify-between max-w-5xl mx-auto mb-4">
        <div>
          <h1 className="text-2xl font-semibold">{event.name}</h1>
          <p className="text-sm text-gray-500">
            {event.dates.length} {event.mode === 'weekdays_recurring' ? 'weekdays' : 'dates'} ·{' '}
            {event.timeRange.start}:00–{event.timeRange.end}:00 · {event.slotMinutes} min slots ·{' '}
            {event.timezone}
          </p>
          {isHost && <div className="mt-2"><HostBadge /></div>}
        </div>
        <div className="text-sm text-gray-500">
          {myParticipant ? `Painting as ${myParticipant.name}` : ''}
        </div>
      </div>

      {myParticipant && <AvailabilityGrid />}

      {showNamePrompt && <NamePrompt priorNames={priorNames} onSubmit={handleJoin} />}
    </div>
  )
}
```

- [ ] **Step 3: Lint, typecheck, test**

```bash
npm run lint && npm run typecheck && npm test
```

Expected: all 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/HostBadge.tsx src/pages/EventPage.tsx
git commit -m "feat(p1): HostBadge + EventPage orchestrates name prompt + grid"
```

---

## Task 22: Update CI workflow to build + deploy Functions

**Files:**
- Modify: `.github/workflows/firebase-hosting-merge.yml`

> **Prerequisite:** Pre-1 (manual IAM role addition) must be done before this task's push, or the Functions deploy will fail with `permission denied`.

- [ ] **Step 1: Read the current workflow file**

Read `.github/workflows/firebase-hosting-merge.yml`. It has steps for: checkout, setup-node, npm ci, lint, typecheck, test, build, hosting deploy.

- [ ] **Step 2: Replace the file with the updated version**

```yaml
# This file was auto-generated by the Firebase CLI and extended for full CI.
# https://github.com/firebase/firebase-tools

name: Deploy to Firebase Hosting on merge
on:
  push:
    branches:
      - main
permissions:
  contents: read
jobs:
  build_and_deploy:
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

      - name: Test (root)
        run: npm test

      - name: Install functions deps
        working-directory: functions
        run: npm ci

      - name: Test (functions)
        working-directory: functions
        run: npm test

      - name: Build (functions)
        working-directory: functions
        run: npm run build

      - name: Build (root)
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_FIREBASE_MEASUREMENT_ID: ${{ secrets.VITE_FIREBASE_MEASUREMENT_ID }}
        run: npm run build

      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_SCHEDULE2GATHER }}
          channelId: live
          projectId: schedule2gather

      - name: Deploy Functions
        env:
          GOOGLE_APPLICATION_CREDENTIALS: ${{ runner.temp }}/sa.json
        run: |
          echo '${{ secrets.FIREBASE_SERVICE_ACCOUNT_SCHEDULE2GATHER }}' > "$GOOGLE_APPLICATION_CREDENTIALS"
          npx firebase-tools@latest deploy --only functions --project schedule2gather --non-interactive
```

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/firebase-hosting-merge.yml
git commit -m "ci(p1): build + deploy Functions in merge workflow"
git push
```

- [ ] **Step 4: Watch the CI run**

Open `https://github.com/chlgustjr41/schedule2gather/actions` and watch the latest workflow run. Expected: all steps green. The Deploy Functions step takes 60–90 seconds.

If Deploy Functions fails with "permission denied":
- Confirm Pre-1 was done — the service account must have Cloud Functions Admin, Service Account User, Cloud Run Admin, and Artifact Registry Writer roles.
- After adding roles, re-run the failed workflow from the GitHub UI.

---

## Task 23: P1 acceptance verification

**Files:** none new.

- [ ] **Step 1: Open two browsers (different profiles or incognito + regular)**

Browser A and Browser B should have different anonymous Firebase UIDs (visible in DevTools Console as P0's `Anonymous UID:` line).

- [ ] **Step 2: Browser A — create event**

1. Visit `https://schedule2gather.web.app/`
2. Fill the form: Name "P1 Smoke", any tab/mode, valid time range, 30-min slots, your local TZ
3. Submit → should redirect to `/e/{slug}`
4. Name prompt appears → enter "Alice"
5. Grid renders. Paint a small rectangle (drag from cell to cell). Pointer-up → cell colors should persist.

- [ ] **Step 3: Browser B — join the same event**

1. Copy the URL from Browser A (`https://schedule2gather.web.app/e/{slug}`) and open in Browser B
2. Name prompt appears → enter "Bob"
3. Grid renders, including Alice's painted cells (visible in green tint as "1 of 1 painted = 100% intensity")
4. Paint a different rectangle that overlaps Alice's a bit
5. Pointer-up → write fires

- [ ] **Step 4: Both browsers — verify live aggregation**

- Within ~1 second of Bob's paint, Browser A's grid should show updated heatmap reflecting Bob's cells (in green tint where Bob painted alone, brighter where both Alice and Bob painted)
- Hover any painted cell in Browser A → tooltip lists names available at that slot
- Hover an empty cell → tooltip shows "No one available"

- [ ] **Step 5: Refresh persistence**

- Refresh Browser A → name prompt should NOT re-appear (auto-load via localStorage), painted cells should remain visible
- Open Browser A in incognito → fresh user, name prompt shows, painted cells from Alice/Bob are visible (you're a viewer until you join)

- [ ] **Step 6: Verify CI is green**

Check `https://github.com/chlgustjr41/schedule2gather/actions` — latest run should be green (deployed both Hosting and Functions).

- [ ] **Step 7: Tag the phase**

```bash
git tag phase-1-complete
git push origin phase-1-complete
```

- [ ] **Step 8: Update BACKLOG.md**

Read `BACKLOG.md`. Move the Phase 1 entry (`Remove the console.log…`) to "Done in P1" or mark it resolved. Add any new items observed during P1 to the appropriate phase section.

For now, remove the P1 entry (it's already done in this phase plan — Task 15 retained the TODO comment but the console.log is intentional through P0; P1 has the same comment in `App.tsx` since we copied it forward).

Actually: re-read `src/App.tsx` from Task 15. The `console.log` is still there with the `TODO(p1): remove` comment. P1 is now complete; the comment is stale. **Action: remove the console.log line and the comment in this step.**

```bash
# Edit src/App.tsx to remove the two-line block:
#   // TODO(p1): remove — needed for P0 acceptance only
#   console.log('Anonymous UID:', user.uid)
# (Keep the surrounding useEffect and `if (user)` check; just remove the console.log line.)
# Or remove the entire useEffect since `if (user) {...}` is now empty.
```

After editing, run lint + typecheck:

```bash
npm run lint && npm run typecheck && npm test
```

Then commit:

```bash
git add src/App.tsx BACKLOG.md
git commit -m "chore(p1): remove P0 console.log per P1 backlog item"
git push
```

- [ ] **Step 9: Phase 1 complete**

You now have:
- Working event creation with both modes
- Real-time live aggregation across browsers
- Per-event participant identity via UUID + localStorage
- Bitmap-encoded availability with rectangle drag-paint
- Tightened Firestore security rules
- CI deploys both Hosting and Functions
- Phase 5 will lock down rules with emulator tests; P2–P4 layer per-TZ, mobile drag, ranking, polish on top

---

## Self-review notes

This plan was reviewed against the design at `docs/superpowers/specs/2026-05-03-phase-1-design.md`:

**Spec coverage:**
- ✅ §2 Data model — Tasks 4 (bitmap), 5 (slots) cover the encoding; Tasks 11+12 wire docs into services
- ✅ §3 Routing & flows — Task 15 (router), 16 (create form), 21 (event page orchestration)
- ✅ §4 Cloud Function — Tasks 8 (slug), 9 (validate), 10 (handler)
- ✅ §5 Security rules — Task 2
- ✅ §6 State management — Tasks 13, 14
- ✅ §7 Component map — Tasks 16–21 cover all 7 components plus pages
- ✅ §8 Testing — TDD applied in tasks 4–9; UI manual in 23
- ✅ §9 Functions deploy + CI — Task 22 (with Pre-1 prerequisite)
- ✅ §10 Edge cases — handled in services (event-not-found in eventService→eventStore→EventNotFound), in EventPage (loading/notFound branches), and in CreateEventForm (try/catch → error state)
- ✅ §11 Non-goals — explicitly out of scope; not addressed by any task
- ✅ §12 Acceptance — Task 23

**Type consistency:**
- `EventDoc` shape declared once in `eventService.ts`, used by `eventStore`, `EventPage`, `AvailabilityGrid`
- `ParticipantDoc` shape declared in `participantService.ts`, used in same chain
- `slotsPerDay` signature `(timeRange, slotMinutes)` consistent across `slots.ts`, `validate.ts`, `AvailabilityGrid.tsx`
- `setRectangle` signature `(bits, fromIdx, toIdx, value, slotsPerDay)` consistent in `bitmap.ts`, `paintStore.ts`

**No placeholders:** every task has complete code; no "TODO" lines in production code beyond the one P1 task (Task 23 step 8) explicitly removes.

**Note on `src/App.tsx`** in Task 15: the file copies forward the P0 `console.log('Anonymous UID:', user.uid)` line (with `// TODO(p1): remove` comment) intentionally. Task 23 step 8 explicitly removes it as part of P1 completion. This is a deliberate two-step process so that during P1 execution debugging stays easy, and removal is a documented closing step.
