// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_3409 (ROM 0x3409) — the object sprite-animation stepper.
 *
 * loc_3409 is a LEAF whose entire memory-observable behaviour is a function of just TWO
 * bytes of the object record it is handed — the animation down-counter (+0x15) and the
 * sprite tile code (+0x07) — and it writes only those two bytes. It returns nothing a caller
 * consumes (both callers reload the accumulator on the instruction right after the call), so
 * the contract is memory-only, and the two-byte input space (256×256) is small enough to
 * sweep EXHAUSTIVELY — a proof, not a sample. Behaviour splits into two disjoint paths:
 *
 *   PATH A — timer still running (timer != 0): ticks the timer down and returns; the sprite
 *            code is left untouched. The written byte depends only on the timer.
 *   PATH B — timer expired (timer == 0): reloads the timer to 2, steps the sprite code, and
 *            (only when the stepped code's low nibble is all-ones) toggles bit 1. Depends
 *            only on the sprite-code byte.
 *
 * The full grid over all (timer, code) pairs covers both paths and every boundary between
 * them, at a real 0x6400 object record so the writes land in mapped work RAM.
 *
 *   1. EQUAL (exhaustive) — loc_3409 == oracle on RAM across all 65536 (timer, code) pairs.
 *   2. TEETH (exhaustive) — three deliberately-broken twins the same grid MUST catch.
 *   3. REALISM (captured dispatches) — hook 0x3409 in a real attract run (the object update
 *      dispatches it with IX = 0x6400) and confirm loc_3409 reproduces the oracle's RAM on
 *      every real state the game actually produces.
 *
 * The oracle is a leaf that only pops (its terminal `ret`) and never pushes, so it writes no
 * stack: NO STACK_SCRATCH exclusion is needed and the RAM diff is over the whole dump. The
 * frame machinery is neutralised (clone() sets nextNmi/nextBoundary = Infinity) so a stray
 * NMI cannot masquerade as a side effect while the routine runs in isolation.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-3409.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3409 as oracle } from "../../translated/loc_3409.js";
import { stepObjectSpriteFrame as loc_3409 } from "../stepObjectSpriteFrame.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x3409;
// The single object record loc_3409 is really dispatched against in attract (IX = 0x6400,
// the base of the stride-0x20 0x6400 object array); its two touched fields land in work RAM.
const IX_BASE = 0x6400;
const TIMER_OFF = 0x15;  // per-object animation down-counter
const CODE_OFF = 0x07;   // OBJ_SPRITE_CODE — the animated sprite tile code
const TIMER_ADDR = IX_BASE + TIMER_OFF; // 0x6415
const CODE_ADDR = IX_BASE + CODE_OFF;   // 0x6407
// The oracle's terminal `ret` pops the stack; point SP at work RAM so that pop reads valid
// bytes (never I/O). A leaf only pops, so this never affects the compared memory.
const SAFE_SP = 0x6bf8;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * A synthetic entry: a clone of `base` with IX aimed at the real object record, its two input
 * bytes set, and a safe stack. Frame machinery is neutralised so the oracle's `m.step` cannot
 * fire an NMI or push a frame while running in isolation.
 */
function makeEntry(base, timer, code) {
  const e = base.clone();
  e.regs.ix = IX_BASE;
  e.mem.write8(TIMER_ADDR, timer);
  e.mem.write8(CODE_ADDR, code);
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and a candidate on two FRESH, byte-identical entries and diff the
 * memory-equivalence contract (RAM over the whole dump). A fresh entry per side because the
 * routine WRITES memory — a reused machine would carry the previous run forward.
 */
function runPair(base, timer, code, candidate) {
  const a = makeEntry(base, timer, code); // oracle
  const b = makeEntry(base, timer, code); // candidate
  oracle(a);
  candidate(b, IX_BASE);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { ram };
}

/** Sweep every (timer, code) pair. Returns the first mismatch (or null) and the combo count. */
function fullGrid(base, candidate) {
  let count = 0;
  for (let t = 0; t < 256; t++) {
    for (let c = 0; c < 256; c++) {
      const { ram } = runPair(base, t, c, candidate);
      count++;
      if (ram) return { mismatch: { t, c, ram }, count };
    }
  }
  return { mismatch: null, count };
}

const describeMismatch = (mm) =>
  mm &&
  `at timer=${hx(mm.t)} code=${hx(mm.c)}: ` +
    `RAM diverges at 0x${(mm.ram.addr ?? 0).toString(16)} (${mm.ram.a}->${mm.ram.b})`;

// -- 0. REACHABILITY ----------------------------------------------------------

test("REACHABILITY: 0x3409 is dispatched during attract", () => {
  let count = 0;
  const snap = new Map([[TARGET, (mm) => { count++; return oracle(mm); }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(1500);
  assert.ok(count > 0, "0x3409 should be dispatched by the object update during attract");
  console.log(`  REACHABILITY: ${count} natural 0x3409 dispatches in 1500 frames`);
});

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): loc_3409 == oracle across all 65536 (timer, code) pairs", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullGrid(base, loc_3409);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  assert.equal(count, 256 * 256, "must have compared the full two-byte input space");
  console.log(`  EQUAL/exhaustive: ${count} (timer, code) pairs — RAM identical to the oracle`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/**
 * BUG (a): OR instead of TOGGLE. At the boundary the low nibble is all-ones so bit 1 is set;
 * the oracle's toggle CLEARS it (low nibble -> 0x0d) while this twin's OR leaves it set
 * (low nibble stays 0x0f) — a wrong sprite-code byte. Caught wherever the boundary is hit.
 */
function brokenOrNotToggle(m, objBase) {
  const { mem } = m;
  const timerAddr = (objBase + TIMER_OFF) & 0xffff;
  const codeAddr = (objBase + CODE_OFF) & 0xffff;
  const timer = mem.read8(timerAddr);
  if (timer !== 0) { mem.write8(timerAddr, timer - 1); return; }
  mem.write8(timerAddr, 0x02);
  mem.write8(codeAddr, mem.read8(codeAddr) + 1);
  const code = mem.read8(codeAddr);
  if ((code & 0x0f) !== 0x0f) return;
  mem.write8(codeAddr, code | 0x02); // BUG: OR instead of XOR
}

/** BUG (b): reloads the timer to 3 instead of 2 — a wrong timer byte on every expiry. */
function brokenReloadValue(m, objBase) {
  const { mem } = m;
  const timerAddr = (objBase + TIMER_OFF) & 0xffff;
  const codeAddr = (objBase + CODE_OFF) & 0xffff;
  const timer = mem.read8(timerAddr);
  if (timer !== 0) { mem.write8(timerAddr, timer - 1); return; }
  mem.write8(timerAddr, 0x03); // BUG: should reload to 2
  mem.write8(codeAddr, mem.read8(codeAddr) + 1);
  const code = mem.read8(codeAddr);
  if ((code & 0x0f) !== 0x0f) return;
  mem.write8(codeAddr, code ^ 0x02);
}

/** BUG (c): inverts the timer gate — advances the sprite when the timer is still running and
 *  decrements when it has expired, so both bytes go wrong immediately. */
function brokenTimerGateInverted(m, objBase) {
  const { mem } = m;
  const timerAddr = (objBase + TIMER_OFF) & 0xffff;
  const codeAddr = (objBase + CODE_OFF) & 0xffff;
  const timer = mem.read8(timerAddr);
  if (timer === 0) { mem.write8(timerAddr, timer - 1); return; } // BUG: should be `!== 0`
  mem.write8(timerAddr, 0x02);
  mem.write8(codeAddr, mem.read8(codeAddr) + 1);
  const code = mem.read8(codeAddr);
  if ((code & 0x0f) !== 0x0f) return;
  mem.write8(codeAddr, code ^ 0x02);
}

test("TEETH (exhaustive): the OR-instead-of-toggle twin is CAUGHT (sprite-code byte diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullGrid(base, brokenOrNotToggle);
  assert.notEqual(mismatch, null, "the grid FAILED to catch an OR-for-toggle — the RAM check is worthless");
  assert.equal(mismatch.ram.addr, CODE_ADDR, "the OR twin must diverge on the sprite-code byte");
  console.log(`  TEETH/toggle: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the wrong-reload-value twin is CAUGHT (timer byte diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullGrid(base, brokenReloadValue);
  assert.notEqual(mismatch, null, "the grid FAILED to catch a wrong reload value — worthless");
  assert.equal(mismatch.ram.addr, TIMER_ADDR, "the reload twin must diverge on the timer byte");
  console.log(`  TEETH/reload: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the inverted-timer-gate twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullGrid(base, brokenTimerGateInverted);
  assert.notEqual(mismatch, null, "the grid FAILED to catch an inverted timer gate — worthless");
  console.log(`  TEETH/gate: caught — ${describeMismatch(mismatch)}`);
});

// -- 3. REALISM (captured dispatches) -----------------------------------------

/**
 * Hook 0x3409 in a real attract run and clone the machine at up to K real dispatches. The
 * object update dispatches it against IX = 0x6400; the wrapper clones the entry state, then
 * runs the oracle so the host game proceeds undisturbed.
 */
function captureDispatches(K, maxFrames) {
  const caps = [];
  const snapshot = new Map([[TARGET, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snapshot });
  host.runFrames(maxFrames);
  return caps;
}

test("REALISM: real captured 0x3409 dispatches — loc_3409 matches oracle RAM", () => {
  const caps = captureDispatches(200, 1500);
  assert.ok(caps.length >= 1, "expected at least one real 0x3409 dispatch during attract");

  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    a.nextNmi = Infinity; a.nextBoundary = Infinity;
    b.nextNmi = Infinity; b.nextBoundary = Infinity;
    oracle(a);
    loc_3409(b, b.regs.ix);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      ram,
      null,
      ram &&
        `RAM diverges on real dispatch (ix=0x${(b.regs.ix & 0xffff).toString(16)}) ` +
          `at 0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`,
    );
  }
  console.log(`  REALISM: ${caps.length} real 0x3409 dispatches — RAM == oracle`);
});
