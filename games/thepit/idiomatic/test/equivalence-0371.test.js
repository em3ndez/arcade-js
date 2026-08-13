// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for submitHighScoresAndReset (ROM 0x0371, The Pit) — the
 * game-over teardown: play the game-over jingle, finish each active player's score against
 * the "BEST SCORES TODAY" table (initials entry if it places), then reset the game state
 * and hand off to the reset/entry handler.
 *
 * WHY A CRAFTED ENTRY. The game-over path is never dispatched in a boot/attract run (a probe
 * over 4000 frames sees 0 — attract never runs a game to its end), so the capture/replay
 * harness cannot hook 0x0371 directly. Per the crafted-entry method the gate runs it from a
 * REAL captured sound-request state: the sibling sound stub 0x4c57 IS reached during attract,
 * and its entry is a faithful machine — a valid stack with a return address and live work RAM.
 * The one input that steers the routine — the player-count byte (GAME_STATE) — is then poked
 * identically on both sides over its arms (0/3 skip, 1 = one player, 2 = two players). The top
 * DIP bit is cleared so the dip decode takes its normal path (its set-bit arm tail-jumps into a
 * still-oracle test screen that only makes progress under the live frame loop). 0x0371 never
 * calls 0x4c57, so cloning that entry introduces no registry recursion.
 *
 * THREE WRINKLES:
 *   1. The frame waits. The game-over hold and the round-setup screen busy-wait on the
 *      per-frame countdown cell (0x8009) reaching 0 — driven in the live game by the per-frame
 *      interrupt, which does not fire on an isolated clone. So the harness models that
 *      once-per-frame tick with ONE hook installed IDENTICALLY on both clones: each watchdog
 *      read (a wait does exactly one per pass) drains the countdown, floored at 0. Same hook on
 *      both sides -> it can only reveal a difference, never manufacture one. (Same device as
 *      the showSetupScreen gate.)
 *   2. The reset/entry target. The routine ends with a tail hand-off to 0x01f9, still the
 *      frozen oracle, which resets the stack and runs on into the attract/main loop and never
 *      returns. It is stubbed to a no-op IDENTICALLY on both clones (both reach it through the
 *      same address-level hand-off), so the routine terminates and the diff isolates the
 *      teardown's own work — exactly the oracle boundary the tail models.
 *   3. The stack scratch. The oracle wraps every callee in a stack push + return, while the
 *      idiomatic routine calls its already-decompiled leaves directly. The two therefore leave
 *      DIFFERENT dead bytes in the top-of-stack scratch window just below the stack pointer the
 *      routine resets to (0x83ff). No real cell lies in it (measured 0x83f7..0x8400 across every
 *      arm), so the RAM diff EXCLUDES that window and compares every real work / colour / video /
 *      sprite cell byte-for-byte; the teeth confirm the window hides no real output.
 *
 * Naturally-scored states do not place (the fresh table outranks a zero score), so the
 * initials-entry arm (call to runHighScoreInitialsEntry) is gated off here; that delegate has
 * its own comprehensive gate (equivalence-4df8).
 *
 * CHECKS:
 *   0. HARNESS — 0x0371 is never dispatched in attract (justifies the crafted entry); a real
 *      0x4c57 entry is captured; the oracle run is deterministic (oracle vs oracle identical).
 *   1. EQUAL (player-count sweep) — for player count 0/1/2/3, submitHighScoresAndReset == oracle
 *      over RAM outside the dead stack scratch, and the reset outputs (player-count cleared,
 *      secondary state armed to 1, the game-over jingle queued) hold their values.
 *   2. TEETH (reset arming)   — a twin that corrupts the armed secondary-state byte is CAUGHT in work RAM.
 *   3. TEETH (setup screen)   — a twin that corrupts a painted setup-screen record is CAUGHT in video RAM.
 *   4. TEETH (game-over jingle) — a twin that corrupts the queued sound-ring slot is CAUGHT in work RAM.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-0371.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0371 as oracle } from "../../translated/loc_0371.js";
import { submitHighScoresAndReset as idiomatic } from "../submitHighScoresAndReset.js";
import { loc_4c57 as siblingStub } from "../../translated/loc_4c57.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { GAME_STATE, ACTIVE_PLAYER, SOUND_RING } from "../names.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
// RETIRED (coroutine go-live): this address is a control-SPINE routine — now a generator (or a caller of
// one) under runIdiomaticGame. Its isolated crafted-entry harness below drove it as a plain function,
// which no longer models it: a boot-chain / main-loop / wait generator never "returns", and a transition
// is a mid-frame throw-restart, neither expressible as one plain call. The WHOLE-GAME byte-exact coroutine
// gates SUBSUME it — idiomatic.test.js (boot->attract), tape.test.js (coin/start/dig), transition.test.js
// (level / round / game-over boundaries) run every spine routine live and diff against the translated
// oracle frame-for-frame. Kept (not deleted) to preserve the harness + rationale. See
// docs/integration-testing.md "Go-live, the RIGHT way".
const test = (name, fn) => nodeTest(name, { skip: "retired: control-spine routine validated by the whole-game coroutine gates (idiomatic/tape/transition)" }, fn);

const TARGET = 0x0371;
const CAPTURE_AT = 0x4c57; // sibling sound stub — a real machine state, reached in attract
const ENTRY_HANDLER = 0x01f9; // the still-oracle reset/entry target the tail hands off to

const WATCHDOG = 0xb800; // reading it kicks the watchdog (once per frame-wait pass)
const WAIT_COUNTDOWN = 0x8009; // the per-frame countdown each frame-wait drains to 0

// Dead top-of-stack scratch just below the stack pointer the routine resets to (0x83ff): the
// oracle's per-call pushes and the idiomatic direct calls legitimately differ here. Measured
// span 0x83f7..0x8400 across every arm; the window has a small margin and the teeth prove no
// real cell hides in it.
const STACK_SCRATCH_LO = 0x83f5;
const STACK_SCRATCH_HI = 0x8400;

// Real output cells the teeth corrupt (all far outside the stack window; the routine writes each).
const RESET_ARM_CELL = ACTIVE_PLAYER; // 0x8002 — secondary state re-armed to 1 by the reset epilogue
const SETUP_RECORD_CELL = 0x928e; // a count record the round-setup screen paints (video RAM)
const JINGLE_SLOT = SOUND_RING; // 0x8020 — ring slot 0, where the game-over jingle is queued
const JINGLE_PENDING = 0x85; // command 5 with the pending high bit set

const PLAYER_COUNTS = [0, 1, 2, 3]; // skip / one player / two players (0 and 3 both skip)
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is async, so
// build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/**
 * Run a boot/attract session, hooking the sibling sound stub 0x4c57 (a real machine state) to
 * clone the machine at its first dispatch, and counting how often the game-over target 0x0371
 * is dispatched (to justify the crafted entry). The wrappers run the oracle so attract proceeds.
 */
function bootAndCapture(maxFrames) {
  let entry = null;
  let gameOverHits = 0;
  const hooks = new Map([
    [CAPTURE_AT, (mm) => {
      if (entry === null) entry = mm.clone();
      return siblingStub(mm);
    }],
    [TARGET, (mm) => {
      gameOverHits++;
      return oracle(mm);
    }],
  ]);
  makeMachine(hooks).runFrames(maxFrames);
  return { entry, gameOverHits };
}

/**
 * Model the once-per-frame interrupt tick that drives each frame wait to completion: every
 * watchdog read (a frame wait does exactly one per pass) drains the per-frame countdown by one,
 * floored at 0. Installed identically on both clones, so it can only expose a difference.
 */
function installFrameTick(m) {
  const mem = m.mem;
  const origRead8 = mem.read8.bind(mem);
  mem.read8 = (addr) => {
    if (addr === WATCHDOG) {
      const c = origRead8(WAIT_COUNTDOWN);
      if (c !== 0) mem.write8(WAIT_COUNTDOWN, c - 1);
    }
    return origRead8(addr);
  };
}

/** Stub the still-oracle reset/entry target so the tail hand-off terminates instead of running
 *  on into the attract/main loop. Installed identically on both clones. */
function stubEntryHandler(m) {
  m.routines.set(ENTRY_HANDLER, () => {});
}

/**
 * A real captured entry with a surgical nudge: the player-count byte poked to select an arm, and
 * the top DIP bit cleared so the dip decode takes its normal path.
 */
function craft(seed, playerCount) {
  const e = seed.clone();
  e.mem.write8(GAME_STATE, playerCount);
  e.io.dsw = e.io.dsw & 0x7f;
  return e;
}

/**
 * First differing RAM byte between two machines, EXCLUDING the dead top-of-stack scratch window
 * (where the oracle's per-call pushes and the idiomatic direct calls legitimately differ). Null
 * when otherwise identical.
 */
function ramDiffOutsideStack(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= STACK_SCRATCH_LO && addr <= STACK_SCRATCH_HI) continue; // dead stack scratch
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/**
 * Run the oracle and a candidate on two independent clones of a crafted entry — frame-tick hook
 * and stubbed entry handler on both — and diff the memory-equivalence contract: RAM outside the
 * dead top-of-stack scratch. (pc/SP and the dead value registers are not compared.)
 */
function runPair(entry, candidate) {
  const a = entry.clone();
  const b = entry.clone();
  for (const m of [a, b]) { installFrameTick(m); stubEntryHandler(m); }
  oracle(a);
  candidate(b);
  return { ram: ramDiffOutsideStack(a, b), oracleM: a, candM: b };
}

/** Run one machine to completion with the harness on (for positive checks). */
function runOne(entry, fn) {
  const c = entry.clone();
  installFrameTick(c);
  stubEntryHandler(c);
  fn(c);
  return c;
}

// -- 0. HARNESS (reachability + capture + determinism) ------------------------

let SEED = null;
test("HARNESS: 0x0371 is unreached in attract; a real 0x4c57 entry is captured; the oracle run is deterministic", () => {
  const { entry, gameOverHits } = bootAndCapture(2000);
  assert.equal(gameOverHits, 0, "the game-over path 0x0371 must not be dispatched in attract (justifies the crafted entry)");
  assert.ok(entry, "expected the sibling sound stub 0x4c57 to be dispatched during attract");
  SEED = entry;

  const one = craft(SEED, 1);
  const a = runOne(one, oracle);
  const b = runOne(one, oracle);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, d && `oracle run not deterministic: diff at ${hx(d.addr ?? 0)}`);
  console.log(`  HARNESS: 0x0371 unreached in attract; captured a real 0x4c57 entry (SP=${hx(SEED.regs.sp)}); oracle deterministic`);
});

// -- 1. EQUAL across the player-count sweep -----------------------------------

test("EQUAL (player-count sweep): submitHighScoresAndReset == oracle over RAM for player count 0/1/2/3", () => {
  assert.ok(SEED, "need a captured 0x4c57 entry (HARNESS must run first)");

  for (const playerCount of PLAYER_COUNTS) {
    const entry = craft(SEED, playerCount);
    const { ram } = runPair(entry, idiomatic);
    assert.equal(ram, null, ram && `player count ${playerCount}: RAM diverged at ${hx(ram.addr ?? 0)} (oracle=${ram.a} idiomatic=${ram.b})`);

    // Positive checks on a fresh run: the reset epilogue cleared the player-count byte and armed
    // the secondary state to 1, and the game-over jingle (command 5) was queued.
    const c = runOne(entry, idiomatic);
    assert.equal(c.mem.read8(GAME_STATE), 0, `player count ${playerCount}: player-count byte not cleared`);
    assert.equal(c.mem.read8(ACTIVE_PLAYER), 1, `player count ${playerCount}: secondary state not armed to 1`);
    assert.equal(c.mem.read8(JINGLE_SLOT), JINGLE_PENDING, `player count ${playerCount}: game-over jingle not queued`);
  }
  console.log("  EQUAL/sweep: player counts 0/1/2/3 — idiomatic == oracle; player-count cleared, state armed, jingle queued");
});

// -- 2-4. TEETH: broken twins the gate MUST catch -----------------------------

/** Broken twin: runs correctly, then corrupts one real output cell. */
function corruptCell(cell) {
  return (m) => {
    idiomatic(m);
    m.mem.write8(cell, m.mem.read8(cell) ^ 0xff);
  };
}

test("TEETH (reset arming): a corrupted secondary-state byte is CAUGHT in work RAM", () => {
  assert.ok(SEED, "need a captured 0x4c57 entry");
  const { ram } = runPair(craft(SEED, 1), corruptCell(RESET_ARM_CELL));
  assert.notEqual(ram, null, "the gate FAILED to catch a corrupted reset arming — it proves nothing");
  assert.equal(ram.addr, RESET_ARM_CELL, `teeth caught the wrong address ${hx(ram.addr ?? 0)} (expected ${hx(RESET_ARM_CELL)})`);
  console.log(`  TEETH/reset: corrupted arming caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

test("TEETH (setup screen): a corrupted setup-screen record is CAUGHT in video RAM", () => {
  assert.ok(SEED, "need a captured 0x4c57 entry");
  const { ram } = runPair(craft(SEED, 1), corruptCell(SETUP_RECORD_CELL));
  assert.notEqual(ram, null, "the gate FAILED to catch a corrupted setup-screen record — it proves nothing");
  assert.equal(ram.addr, SETUP_RECORD_CELL, `teeth caught the wrong address ${hx(ram.addr ?? 0)} (expected ${hx(SETUP_RECORD_CELL)})`);
  console.log(`  TEETH/setup: corrupted record caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

test("TEETH (game-over jingle): a corrupted queued sound-ring slot is CAUGHT in work RAM", () => {
  assert.ok(SEED, "need a captured 0x4c57 entry");
  const { ram } = runPair(craft(SEED, 1), corruptCell(JINGLE_SLOT));
  assert.notEqual(ram, null, "the gate FAILED to catch a corrupted jingle slot — it proves nothing");
  assert.equal(ram.addr, JINGLE_SLOT, `teeth caught the wrong address ${hx(ram.addr ?? 0)} (expected ${hx(JINGLE_SLOT)})`);
  console.log(`  TEETH/jingle: corrupted jingle slot caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});
