// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for dispatchCreditedSubstate (ROM 0x08B2) — the credited-state
 * (GAME_STATE 2) per-frame sub-state dispatcher: `ld a,(0x600a)` then vector through
 * the 2-entry inline jump table at ROM 0x08B6 (sub-state 0 -> 0x08BA, 1 -> 0x08F8).
 *
 * loc_08b2 is NOT reached in plain attract (attract holds GAME_STATE 0/1); it fires only
 * once a coin has been accepted and the credited-state setup runs. And it is not a leaf —
 * it dispatches a sub-state handler that clears the playfield, sets up 1P/2P and advances
 * the game state. So it is validated by MEMORY-equivalence against the frozen oracle
 * (RAM − STACK_SCRATCH, pc, SP), never the full register file and never cycles, with a
 * FRESH clone per case:
 *
 *   1. REALISM (captured coin dispatches) — drop a coin so GAME_STATE reaches 2, hook
 *      0x08b2, and clone the machine at each real dispatch. For each, run the ORACLE on one
 *      clone and dispatchCreditedSubstate on another and prove RAM(−stack) + pc + SP
 *      identical — the FULL oracle sub-state handler runs on BOTH sides, so a wrong target
 *      OR a live register/flag handoff the folded-away trampoline would have supplied
 *      surfaces as divergent memory. A coin naturally reaches BOTH sub-states: 0 once (the
 *      setup arm, 0x08BA) then 1 for the rest (the idle "wait for start" arm, 0x08F8).
 *
 *   2. CRAFTED (exhaustive selector sweep) — the off-table indices the coin run never
 *      reaches (the table has only 2 real slots and the selector is NOT range-checked). On a
 *      real captured credited-state, poke GAME_SUBSTATE to every byte 0..255 identically on
 *      both sides and route ANY computed target to an IDENTICAL catch-all stub (so the
 *      handler never runs), then compare the target the dispatcher handed the stub + SP.
 *      This exhaustively pins the `0x08B6 + (2*sel & 0xff)` 8-bit-wrap table math, including
 *      the wrap region sel >= 0x80.
 *
 *   3. TEETH — a twin that forms the offset as a full 16-bit `2*sel` (skipping the 8-bit
 *      `add a,a` wrap) MUST be caught by the selector sweep at sel >= 0x80.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-08b2.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_08b2 as oracle } from "../../translated/loc_08b2.js";
import { dispatchCreditedSubstate } from "../dispatchCreditedSubstate.js";
import { loc_00ca } from "../../translated/loc_00ca.js";
import { Machine } from "../../machine.js";
import { STACK_SCRATCH } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x08b2;
const GAME_SUBSTATE = 0x600a;
const SUBSTATE_TABLE = 0x08b6;
const DISPATCH_TABLE_08B6 = "0x08B6 (0x600A, 2-entry)";
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// A coin tape: assert IN2 bit7 (coin1) at frame 10 for 6 frames — MAME's coin hold. This
// credits the machine so GAME_STATE reaches 2 and loc_08b2 dispatches per frame. No start
// button, so the credited state persists (sub-state 1 idles waiting for start).
const COIN_TAPE = [{ port: 0x7d00, bits: 0x80, frame: 10, dur: 6 }];

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

// -- 1. REALISM (captured coin dispatches) ------------------------------------

/**
 * Drop a coin and clone the machine at each real 0x08b2 dispatch, keeping up to `perSub`
 * clones per distinct GAME_SUBSTATE value (so the dominant idle sub-state 1 cannot crowd
 * out sub-state 0). The wrapper clones the entry state, then runs the oracle so the host
 * game proceeds undisturbed. Capturing is gated off after the host run so the isolated
 * replays below (whose handlers advance further state) cannot pollute it.
 */
function captureCoinDispatches(perSub, maxFrames) {
  const caps = [];
  const perCount = new Map();
  let capturing = true;
  const snap = new Map([[TARGET, (mm) => {
    if (capturing) {
      const s = mm.mem.read8(GAME_SUBSTATE);
      const c = perCount.get(s) || 0;
      if (c < perSub) { perCount.set(s, c + 1); caps.push(mm.clone()); }
    }
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.inputTape = COIN_TAPE.map((t) => ({ ...t }));
  host.runFrames(maxFrames);
  capturing = false;
  return caps;
}

test("REALISM: real captured credited-state 0x08b2 dispatches — RAM(−stack) + pc + SP match", () => {
  const caps = captureCoinDispatches(6, 300);
  assert.ok(caps.length >= 1, "expected at least one real 0x08b2 dispatch after a coin");

  const seen = new Set();
  let compared = 0;
  for (const cap of caps) {
    seen.add(cap.mem.read8(GAME_SUBSTATE));
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    oracle(a);
    dispatchCreditedSubstate(b);

    const ramDiff = firstRamDiffExStack(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
    assert.equal(
      ramDiff,
      null,
      ramDiff && `RAM diverged at ${hx(ramDiff.addr)}: oracle=${ramDiff.a} cand=${ramDiff.b} ` +
        `(sub-state ${hx(cap.mem.read8(GAME_SUBSTATE))})`,
    );
    assert.equal(b.regs.sp, a.regs.sp, `SP diverged: oracle=${hx(a.regs.sp)} cand=${hx(b.regs.sp)}`);
    assert.equal(b.pc, a.pc, `pc diverged: oracle=${hx(a.pc)} cand=${hx(b.pc)}`);
    compared++;
  }
  // The 2-entry table has exactly two reachable arms, and a coin exercises both.
  assert.ok(seen.has(0) && seen.has(1), `expected both sub-states 0 and 1, saw {${[...seen].sort().join(", ")}}`);
  console.log(
    `  REALISM: ${compared} real dispatches over sub-states {${[...seen].sort().map(hx).join(", ")}} ` +
      `— RAM(−stack)+pc+SP identical`,
  );
});

// -- 2. CRAFTED (exhaustive selector sweep) -----------------------------------

// A catch-all override object (duck-typed like the Machine's overrides Map) that routes
// ANY computed target to `stub`, so the dispatched arm never runs and we can read the
// target the dispatcher formed. loc_00ca consults m.overrides first, and BOTH the
// oracle (via the rst-0x28 trampoline) and the candidate reach the same target through it —
// recording the get() key works for both.
function stubOverrides(rec) {
  const SENTINEL = 0x5a;
  return {
    has: () => true,
    get: (target) => (mm) => { rec.push({ target, sp: mm.regs.sp }); return SENTINEL; },
  };
}

// A base credited-state to poke selectors onto (a real captured 0x08b2 entry).
function craftedBase() {
  const caps = captureCoinDispatches(1, 200);
  assert.ok(caps.length >= 1, "expected a real credited-state 0x08b2 entry to craft from");
  return caps[0];
}

// Run oracle and candidate on identically-poked clones for one selector; return the
// { target, sp } each handed the stub.
function runCraftedSelector(base, candidate, sel) {
  const mA = base.clone();
  const mB = base.clone();
  mA.mem.write8(GAME_SUBSTATE, sel);
  mB.mem.write8(GAME_SUBSTATE, sel);
  const recA = [], recB = [];
  mA.overrides = stubOverrides(recA);
  mB.overrides = stubOverrides(recB);
  oracle(mA);
  candidate(mB);
  return { recA, recB };
}

test("CRAFTED: dispatchCreditedSubstate == oracle over all 256 selectors (0x08B6 table)", () => {
  const base = craftedBase();
  let count = 0;
  let mismatch = null;
  for (let sel = 0; sel < 256 && !mismatch; sel++) {
    const { recA, recB } = runCraftedSelector(base, dispatchCreditedSubstate, sel);
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
  const substate = mem.read8(GAME_SUBSTATE);
  const entry = (SUBSTATE_TABLE + 2 * substate) & 0xffff; // BUG: no 8-bit wrap on the *2
  const target = mem.read8(entry) | (mem.read8((entry + 1) & 0xffff) << 8);
  // Dispatch the (wrong) target through the SAME seam the routine uses, so the catch-all
  // stub sees it.
  loc_00ca(m, target, DISPATCH_TABLE_08B6);
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
