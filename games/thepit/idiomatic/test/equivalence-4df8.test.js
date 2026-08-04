// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for runHighScoreInitialsEntry (ROM 0x4df8) — the high-score
 * initials-entry screen: build the display, run the blink-and-input entry loop, and on
 * completion show the final score readouts.
 *
 * The routine has two exits: an IDLE TIMEOUT (the player never commits an initial, so the
 * frame counter climbs past the timeout and it returns to the caller) and a COMPLETION
 * (all three initials committed, so it rebuilds the screen, confirms, holds, and hands off
 * to the score-readout painter). Both build the same screen first; only the input differs.
 *
 * WHY A CRAFTED ENTRY. 0x4df8 is never dispatched in a boot/attract run (a probe over 4000
 * frames sees 0 — its per-frame handler's display loop is not reached), so the capture/replay
 * harness cannot hook it directly. Per the crafted-entry method the gate runs it from a REAL
 * captured sound-request state: the sibling stub 0x4c57 IS reached during attract, and its
 * entry is a faithful machine — a valid stack with a return address and live work RAM. The
 * rank selector (0x8048) and the debounced input byte (0x8018) are then poked identically on
 * both sides to sweep the three rank arms and drive each exit — a real state with a surgical
 * nudge. 0x4df8 never calls 0x4c57, so cloning that entry introduces no registry recursion.
 *
 * TWO WRINKLES:
 *   - The frame waits busy-wait on a per-frame countdown (0x8009), and the idle timeout waits
 *     on the frame counter (0x8010) climbing; both are driven by the per-frame interrupt in the
 *     live game. Run in isolation on a clone (frame machinery neutralised) nothing ticks them,
 *     so the loops would never end. The harness models that once-per-frame tick with ONE hook
 *     installed IDENTICALLY on both clones — each watchdog read (one per busy-wait pass)
 *     advances the interrupt's counter chain: it drains the wait countdown and, on the same
 *     chain the interrupt uses, climbs the frame counter toward the timeout. Being the same
 *     hook on both sides, it can only reveal a difference, never manufacture one.
 *   - The idiomatic layer dissolves the oracle's stack-threaded calls into direct JS calls and
 *     does not preserve the Z80 pc/SP; two of the decompiled setup helpers (blankScreen /
 *     setupBoardDisplay) additionally leave the stack pointer nudged. The result is a dead
 *     top-of-stack scratch window (0x83f5..0x8400, straddling the entry SP 0x83fd) that the
 *     stack-free idiomatic writes differently from the oracle and NO real cell depends on. The
 *     RAM diff excludes exactly that window and compares every real work / colour / video /
 *     sprite cell byte-for-byte; the teeth confirm the window hides no real output.
 *
 * CHECKS:
 *   0. HARNESS — capture a real 0x4c57 entry and confirm the oracle run of 0x4df8 (completion
 *      path) is deterministic (oracle vs oracle -> identical whole state).
 *   1. EQUAL (completion, rank sweep) — with the commit bit held, each of the three rank arms:
 *      runHighScoreInitialsEntry == oracle over RAM outside the dead stack scratch, plus the
 *      counter drains to 0, the rank selector clears, and the readouts are drawn.
 *   2. EQUAL (idle timeout, rank sweep) — with no input, the loop times out: identical over RAM,
 *      and the counter is left untouched while the frame counter reached the timeout.
 *   3. TEETH (wrong label tile)   — a twin that corrupts a drawn rank-label cell is CAUGHT in video RAM.
 *   4. TEETH (dropped colour cell) — a twin that corrupts a painted colour column is CAUGHT in colour RAM.
 *   5. TEETH (wrong readout digit) — a twin that corrupts a completion readout cell is CAUGHT in work RAM.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4df8.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4df8 as oracle } from "../../translated/loc_4df8.js";
import { runHighScoreInitialsEntry as idiomatic } from "../runHighScoreInitialsEntry.js";
import { loc_4c57 as siblingStub } from "../../translated/loc_4c57.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { VARIANT, IN0_DEBOUNCED, PLAY_PHASE_COUNTER } from "../names.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
// RETIRED (coroutine go-live): this address is a control-SPINE routine — now a generator (or a caller of
// one) under runGeneratorGame. Its isolated crafted-entry harness below drove it as a plain function,
// which no longer models it: a boot-chain / main-loop / wait generator never "returns", and a transition
// is a mid-frame throw-restart, neither expressible as one plain call. The WHOLE-GAME byte-exact coroutine
// gates SUBSUME it — golive.test.js (boot->attract), tape.test.js (coin/start/dig), transition.test.js
// (level / round / game-over boundaries) run every spine routine live and diff against the translated
// oracle frame-for-frame. Kept (not deleted) to preserve the harness + rationale. See
// docs/integration-testing.md "Go-live, the RIGHT way".
const test = (name, fn) => nodeTest(name, { skip: "retired: control-spine routine validated by the whole-game coroutine gates (golive/tape/transition)" }, fn);

const CAPTURE_AT = 0x4c57; // sibling sound stub — a real machine state, reached in attract
const INITIALS_REMAINING = 0x804b; // the three-initials down-counter the completion drains to 0
const COMMIT_BIT = 0x10; // debounced-input bit the per-frame handler treats as "commit this initial"

// The per-frame interrupt's counter chain, modelled by the frame-tick hook.
const WATCHDOG = 0xb800; // reading it kicks the watchdog (once per busy-wait pass)
const WAIT_COUNTDOWN = 0x8009; // drained to 0 by every frame wait
const T6 = 0x8006, SLOW6 = 0x800f, T7 = 0x8007; // the prescaler chain that paces the frame counter

// Dead top-of-stack scratch straddling the entry SP (0x83fd): the idiomatic writes this window
// differently from the oracle (dissolved stack calls + two setup helpers that nudge SP) and no
// real cell lies in it. Measured span across every arm below.
const STACK_SCRATCH_LO = 0x83f5;
const STACK_SCRATCH_HI = 0x8400;

// Real output cells the teeth corrupt (all outside the stack window; the routine writes each).
const LABEL_TILE = 0x910f; // top cell of a drawn rank-label strip (video RAM)
const COLOUR_CELL = 0x8847; // top cell of a painted colour column (colour RAM)
const READOUT_CELL = 0x8283; // a completion score-readout cell (work RAM)

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const dec8 = (v) => (v - 1) & 0xff;
const inc8 = (v) => (v + 1) & 0xff;

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is async, so
// build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/**
 * Hook the sibling sound stub 0x4c57 in a real attract run and clone the machine at its
 * first dispatch — a genuine machine state (valid stack with a return address). The wrapper
 * snapshots then runs the oracle so attract proceeds.
 */
function captureRealEntry(maxFrames) {
  let entry = null;
  const snapshot = new Map([[CAPTURE_AT, (mm) => {
    if (entry === null) entry = mm.clone();
    return siblingStub(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(maxFrames);
  return entry;
}

/**
 * Model the once-per-frame interrupt tick that drives the frame waits AND the idle timeout to
 * completion: each watchdog read (a wait does exactly one per pass) advances the interrupt's
 * counter chain — drain the wait countdown, and step the prescaler that climbs the frame
 * counter (the frame counter ticks up once per full prescaler cycle, exactly as the interrupt
 * does it). Installed identically on both clones.
 */
function installFrameTick(m) {
  const mem = m.mem;
  const orig = mem.read8.bind(mem);
  mem.read8 = (addr) => {
    if (addr === WATCHDOG) {
      mem.write8(WAIT_COUNTDOWN, dec8(orig(WAIT_COUNTDOWN)));
      let t6 = dec8(orig(T6));
      if (t6 === 0) { mem.write8(SLOW6, dec8(orig(SLOW6))); t6 = 0x3c; }
      mem.write8(T6, t6);
      let t7 = dec8(orig(T7));
      if (t7 === 0) { mem.write8(PLAY_PHASE_COUNTER, inc8(orig(PLAY_PHASE_COUNTER))); t7 = 0x3c; }
      mem.write8(T7, t7);
    }
    return orig(addr);
  };
}

/**
 * First differing RAM byte between two machines, EXCLUDING the dead top-of-stack scratch
 * window the stack-free idiomatic writes differently from the oracle. Null when otherwise
 * identical.
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
 * A real captured entry with a surgical nudge: the rank selector and the debounced input byte
 * poked to select an arm, and the top DSW bit cleared so the dip decode takes its normal path
 * (its set-bit arm hands off to a still-oracle test screen that only makes progress live).
 */
function craft(seed, rank, input) {
  const e = seed.clone();
  e.mem.write8(VARIANT, rank);
  e.mem.write8(IN0_DEBOUNCED, input);
  e.io.dsw = e.io.dsw & 0x7f;
  return e;
}

/**
 * Run the oracle and a candidate on two independent clones of a crafted entry, with the
 * frame-tick harness on both, and diff the memory-equivalence contract: RAM outside the dead
 * top-of-stack scratch. (pc/SP and the dead value registers are not compared.)
 */
function runPair(entry, candidate) {
  const a = entry.clone();
  const b = entry.clone();
  installFrameTick(a);
  installFrameTick(b);
  oracle(a);
  candidate(b);
  return ramDiffOutsideStack(a, b);
}

/** Run one machine to completion with the frame-tick harness (for positive checks). */
function runOne(entry, fn) {
  const c = entry.clone();
  installFrameTick(c);
  fn(c);
  return c;
}

const RANKS = [0, 2, 3]; // the three arms of the rank selector (>=3 not distinct from 3)

// -- 0. HARNESS (reachability + determinism) ---------------------------------

test("HARNESS: a real 0x4c57 entry is captured and the oracle run of 0x4df8 is deterministic", () => {
  const seed = captureRealEntry(1500);
  assert.ok(seed, "expected the sibling sound stub 0x4c57 to be dispatched during attract");
  assert.equal(seed.regs.sp, 0x83fd, "the captured entry SP is the expected top-of-stack");

  const entry = craft(seed, 3, COMMIT_BIT);
  const a = runOne(entry, oracle);
  const b = runOne(entry, oracle);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, d && `oracle run not deterministic: diff at ${hx(d.addr ?? 0)}`);
  console.log(`  HARNESS: captured a real 0x4c57 entry (SP=${hx(seed.regs.sp)}); oracle completion run deterministic`);
});

// -- 1. EQUAL (completion, rank sweep) ---------------------------------------

test("EQUAL (completion): commit-held, each rank -> runHighScoreInitialsEntry == oracle over RAM", () => {
  const seed = captureRealEntry(1500);
  assert.ok(seed, "need a captured 0x4c57 entry");

  for (const rank of RANKS) {
    const entry = craft(seed, rank, COMMIT_BIT);
    const ram = runPair(entry, idiomatic);
    assert.equal(ram, null, ram && `rank ${rank}: RAM diverged at ${hx(ram.addr ?? 0)} (oracle=${ram.a} idiomatic=${ram.b})`);

    // Positive checks on a fresh completion run: all three initials committed, the rank
    // selector cleared, and the readouts drawn.
    const c = runOne(entry, idiomatic);
    assert.equal(c.mem.read8(INITIALS_REMAINING), 0, `rank ${rank}: initials counter not drained to 0`);
    assert.equal(c.mem.read8(VARIANT), 0, `rank ${rank}: rank selector not cleared`);
    assert.notEqual(c.mem.read8(READOUT_CELL), 0, `rank ${rank}: score readouts not drawn`);
  }
  console.log("  EQUAL/completion: all three rank arms identical to the oracle; counter drained, selector cleared, readouts drawn");
});

// -- 2. EQUAL (idle timeout, rank sweep) -------------------------------------

test("EQUAL (idle timeout): no input, each rank -> runHighScoreInitialsEntry == oracle over RAM", () => {
  const seed = captureRealEntry(1500);
  assert.ok(seed, "need a captured 0x4c57 entry");

  for (const rank of [0, 2]) {
    const entry = craft(seed, rank, 0x00);
    const ram = runPair(entry, idiomatic);
    assert.equal(ram, null, ram && `rank ${rank}: RAM diverged at ${hx(ram.addr ?? 0)} (oracle=${ram.a} idiomatic=${ram.b})`);

    // Positive checks: nothing was committed (counter untouched) and the frame counter
    // climbed to the timeout, which is what ended the loop.
    const c = runOne(entry, idiomatic);
    assert.equal(c.mem.read8(INITIALS_REMAINING), 3, `rank ${rank}: idle path committed an initial`);
    assert.ok(c.mem.read8(PLAY_PHASE_COUNTER) >= 60, `rank ${rank}: frame counter did not reach the timeout`);
  }
  console.log("  EQUAL/idle: both rank arms identical to the oracle; nothing committed, frame counter reached the timeout");
});

// -- 3-5. TEETH: broken twins the gate MUST catch ----------------------------

/** Broken twin: paints correctly, then corrupts one real output cell. */
function corruptCell(cell) {
  return (m) => {
    idiomatic(m);
    m.mem.write8(cell, m.mem.read8(cell) ^ 0xff);
  };
}

test("TEETH (wrong label tile): a corrupted rank-label cell is CAUGHT in video RAM", () => {
  const seed = captureRealEntry(1500);
  assert.ok(seed, "need a captured 0x4c57 entry");
  const ram = runPair(craft(seed, 3, 0x00), corruptCell(LABEL_TILE));
  assert.notEqual(ram, null, "the gate FAILED to catch a corrupted label tile — it proves nothing");
  assert.equal(ram.addr, LABEL_TILE, `teeth caught the wrong address ${hx(ram.addr ?? 0)} (expected ${hx(LABEL_TILE)})`);
  console.log(`  TEETH/label: corrupted label tile caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

test("TEETH (dropped colour cell): a corrupted colour-column cell is CAUGHT in colour RAM", () => {
  const seed = captureRealEntry(1500);
  assert.ok(seed, "need a captured 0x4c57 entry");
  const ram = runPair(craft(seed, 3, 0x00), corruptCell(COLOUR_CELL));
  assert.notEqual(ram, null, "the gate FAILED to catch a corrupted colour cell — it proves nothing");
  assert.equal(ram.addr, COLOUR_CELL, `teeth caught the wrong address ${hx(ram.addr ?? 0)} (expected ${hx(COLOUR_CELL)})`);
  console.log(`  TEETH/colour: corrupted colour cell caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

test("TEETH (wrong readout digit): a corrupted completion readout cell is CAUGHT in work RAM", () => {
  const seed = captureRealEntry(1500);
  assert.ok(seed, "need a captured 0x4c57 entry");
  const ram = runPair(craft(seed, 3, COMMIT_BIT), corruptCell(READOUT_CELL));
  assert.notEqual(ram, null, "the gate FAILED to catch a corrupted readout cell — it proves nothing");
  assert.equal(ram.addr, READOUT_CELL, `teeth caught the wrong address ${hx(ram.addr ?? 0)} (expected ${hx(READOUT_CELL)})`);
  console.log(`  TEETH/readout: corrupted readout cell caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});
