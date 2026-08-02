// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for dispatchIntroCutsceneStep (ROM 0x0A76) — the opening Kong-climb
 * cutscene's per-frame step dispatcher: `ld a,(0x6385)` (INTRO_STEP) then vector through
 * the 8-entry inline jump table at ROM 0x0A7A.
 *
 * loc_0a76 is NOT reached in plain attract (verified: 0 dispatches over 2000 attract
 * frames) — it fires only once a game is credited and started, while in-game sub-state 7
 * (the opening cutscene) is active. And it is not a leaf: it dispatches a step handler
 * that writes memory and drives the cutscene. So it is validated by MEMORY-equivalence
 * against the frozen oracle (RAM − STACK_SCRATCH, pc, SP), never the full register file
 * and never cycles, with a FRESH clone per case:
 *
 *   1. REALISM (captured driven dispatches) — drive a coin+start into a credited game so
 *      GAME_STATE reaches 3 and the opening cutscene (sub-state 7) plays, hook 0x0a76, and
 *      clone the machine at each real dispatch. For each, run the ORACLE on one clone and
 *      dispatchIntroCutsceneStep on another and prove RAM(−stack) + pc + SP identical — the
 *      FULL oracle step handler runs on BOTH sides, so a wrong target OR a live
 *      register/flag handoff the folded-away trampoline would have supplied surfaces as
 *      divergent memory. The run naturally reaches all 8 cutscene steps (0..7).
 *
 *   2. CRAFTED (exhaustive selector sweep) — the table indices the driven run never
 *      reaches (INTRO_STEP only ever holds 0..7 in play). On a real captured cutscene
 *      state, poke INTRO_STEP (0x6385) to every byte 0..255 identically on both sides and
 *      route ANY computed target to an IDENTICAL catch-all stub (so the handler never
 *      runs), then compare the target the dispatcher handed the stub + SP. This
 *      exhaustively pins the `0x0A7A + (2*sel & 0xff)` 8-bit-wrap table math, including the
 *      wrap region sel >= 0x80.
 *
 *   3. TEETH — a twin that forms the offset as a full 16-bit `2*sel` (skipping the 8-bit
 *      `add a,a` wrap) MUST be caught by the selector sweep at sel >= 0x80.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-0a76.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0a76 as oracle } from "../../translated/loc_0a76.js";
import { dispatchIntroCutsceneStep } from "../dispatchIntroCutsceneStep.js";
import { dispatchGameState } from "../../translated/dispatchGameState.js";
import { Machine } from "../../machine.js";
import { STACK_SCRATCH } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x0a76;
const INTRO_STEP = 0x6385;
const INTRO_STEP_TABLE = 0x0a7a;
const DISPATCH_TABLE_0A7A = "0x0A7A (0x6385 sequence)";
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// A coin+start tape (as in the 0x06fe dispatcher test): coin on IN2 bit7 at frame 10,
// start1 on IN2 bit2 at frame 30. This credits + starts a game so GAME_STATE reaches 3,
// the opening cutscene (sub-state 7) plays, and loc_0a76 dispatches per frame while it runs.
const COIN_START_TAPE = [
  { port: 0x7d00, bits: 0x80, frame: 10, dur: 6 }, // coin  (IN2 bit7)
  { port: 0x7d00, bits: 0x04, frame: 30, dur: 6 }, // start (IN2 bit2)
];

// First differing RAM byte between two dumps, EXCLUDING the dead stack-scratch region
// (the memory-equivalence contract is RAM − STACK_SCRATCH). Returns { addr, a, b } or null.
function firstRamDiffExStack(a, b, offToAddr) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) continue;
    const addr = offToAddr(i);
    if (addr >= STACK_SCRATCH.lo && addr < STACK_SCRATCH.hi) continue;
    return { addr, a: a[i], b: b[i] };
  }
  return null;
}

// -- 1. REALISM (captured driven dispatches) ----------------------------------

/**
 * Drive a coin+start game and clone the machine at each real 0x0a76 dispatch, keeping up
 * to `perStep` clones per distinct INTRO_STEP value (so one dominant step cannot crowd out
 * the variety). The wrapper clones the entry state, then runs the oracle so the host game
 * proceeds undisturbed. Capturing is gated off after the host run so the isolated replays
 * below (whose handlers dispatch further steps) cannot pollute it.
 */
function captureDrivenDispatches(perStep, maxFrames) {
  const caps = [];
  const perCount = new Map();
  let capturing = true;
  const snap = new Map([[TARGET, (mm) => {
    if (capturing) {
      const s = mm.mem.read8(INTRO_STEP);
      const c = perCount.get(s) || 0;
      if (c < perStep) { perCount.set(s, c + 1); caps.push(mm.clone()); }
    }
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.inputTape = COIN_START_TAPE.map((t) => ({ ...t }));
  host.runFrames(maxFrames);
  capturing = false;
  return caps;
}

test("REALISM: real captured cutscene 0x0a76 dispatches — RAM(−stack) + pc + SP match", () => {
  const caps = captureDrivenDispatches(6, 1500);
  assert.ok(caps.length >= 1, "expected at least one real 0x0a76 dispatch during the opening cutscene");

  const seen = new Set();
  let compared = 0;
  for (const cap of caps) {
    seen.add(cap.mem.read8(INTRO_STEP));
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    oracle(a);
    dispatchIntroCutsceneStep(b);

    const ramDiff = firstRamDiffExStack(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
    assert.equal(
      ramDiff,
      null,
      ramDiff && `RAM diverged at ${hx(ramDiff.addr)}: oracle=${ramDiff.a} cand=${ramDiff.b} ` +
        `(INTRO_STEP ${hx(cap.mem.read8(INTRO_STEP))})`,
    );
    assert.equal(b.regs.sp, a.regs.sp, `SP diverged: oracle=${hx(a.regs.sp)} cand=${hx(b.regs.sp)}`);
    assert.equal(b.pc, a.pc, `pc diverged: oracle=${hx(a.pc)} cand=${hx(b.pc)}`);
    compared++;
  }
  assert.ok(seen.size >= 5, `expected several distinct cutscene steps, saw ${seen.size}`);
  console.log(
    `  REALISM: ${compared} real dispatches over ${seen.size} distinct steps ` +
      `{${[...seen].sort((x, y) => x - y).map(hx).join(", ")}} — RAM(−stack)+pc+SP identical`,
  );
});

// -- 2. CRAFTED (exhaustive selector sweep) -----------------------------------

// A catch-all override object (duck-typed like the Machine's overrides Map) that routes
// ANY computed target to `stub`, so the dispatched arm never runs and we can read the
// target the dispatcher formed (from the get() key; dispatchGameState checks
// `overrides.has(target)` before any target branch, so both oracle and candidate reach it).
function stubOverrides(rec) {
  const SENTINEL = 0x5a;
  return {
    has: () => true,
    get: (target) => (mm) => { rec.push({ target, sp: mm.regs.sp }); return SENTINEL; },
  };
}

// A base cutscene state to poke selectors onto (a real captured 0x0a76 entry).
function craftedBase() {
  const caps = captureDrivenDispatches(1, 400);
  assert.ok(caps.length >= 1, "expected a real cutscene 0x0a76 state to craft from");
  return caps[0];
}

// Run oracle and candidate on identically-poked clones for one selector; return the
// { target, sp } each handed the stub.
function runCraftedSelector(base, candidate, sel) {
  const mA = base.clone();
  const mB = base.clone();
  mA.mem.write8(INTRO_STEP, sel);
  mB.mem.write8(INTRO_STEP, sel);
  const recA = [], recB = [];
  mA.overrides = stubOverrides(recA);
  mB.overrides = stubOverrides(recB);
  oracle(mA);
  candidate(mB);
  return { recA, recB };
}

test("CRAFTED: dispatchIntroCutsceneStep == oracle over all 256 selectors (0x0A7A table)", () => {
  const base = craftedBase();
  let count = 0;
  let mismatch = null;
  for (let sel = 0; sel < 256 && !mismatch; sel++) {
    const { recA, recB } = runCraftedSelector(base, dispatchIntroCutsceneStep, sel);
    count++;
    if (recA.length !== 1 || recB.length !== 1) {
      mismatch = { sel, why: `dispatch fired ${recA.length}/${recB.length} times (want 1/1)` };
    } else if (recA[0].target !== recB[0].target) {
      mismatch = { sel, why: `target ${hx(recA[0].target)}/${hx(recB[0].target)}` };
    } else if (recA[0].sp !== recB[0].sp) {
      mismatch = { sel, why: `SP ${hx(recA[0].sp)}/${hx(recB[0].sp)}` };
    }
  }
  assert.equal(mismatch, null, mismatch && `mismatch at sel=${hx(mismatch.sel)}: ${mismatch.why}`);
  assert.equal(count, 256, "must have swept all 256 selectors");
  console.log(`  CRAFTED: ${count} selectors — dispatched target + SP identical to the oracle`);
});

// -- 3. TEETH -----------------------------------------------------------------

/**
 * Broken twin: forms the table offset as a FULL 16-bit `2*sel` instead of the hardware's
 * 8-bit `add a,a` (`2*sel & 0xff`). It agrees with the oracle for every selector < 0x80
 * and diverges from 0x80 up, so only a sweep across the wrap catches it.
 */
function brokenDispatch(m) {
  const { mem } = m;
  const step = mem.read8(INTRO_STEP);
  const entry = (INTRO_STEP_TABLE + 2 * step) & 0xffff; // BUG: no 8-bit wrap on the *2
  const target = mem.read8(entry) | (mem.read8((entry + 1) & 0xffff) << 8);
  // Dispatch the (wrong) target through the SAME seam the routine uses, so the catch-all
  // stub sees it.
  dispatchGameState(m, target, DISPATCH_TABLE_0A7A);
}

test("TEETH: the 16-bit-offset twin (no 8-bit wrap) is CAUGHT by the selector sweep", () => {
  const base = craftedBase();
  let caughtAt = null;
  for (let sel = 0; sel < 256 && caughtAt === null; sel++) {
    const { recA, recB } = runCraftedSelector(base, brokenDispatch, sel);
    if (recA.length !== 1 || recB.length !== 1 || recA[0].target !== recB[0].target) {
      caughtAt = sel;
    }
  }
  assert.notEqual(caughtAt, null, "the sweep FAILED to catch the missing 8-bit offset wrap — it is worthless");
  console.log(`  TEETH: caught the 16-bit-offset twin at sel=${hx(caughtAt)}`);
});
