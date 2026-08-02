// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_127f (ROM 0x127F) — the animation-sequence phase dispatcher:
 * `ld a,(0x639d)` then vector through the 4-entry inline jump table at ROM 0x1283
 * (phase 0 -> 0x128B, 1 -> 0x12AC, 2 -> 0x12DE, 3 -> 0x0000 unused).
 *
 * loc_127f is NOT reached in plain attract — it is entry 4 of the game-state-1 sub-state
 * table (0x0748, via loc_127c), a deep sub-state the attract demo never drives (0 natural
 * dispatches over an attract run). And it is not a leaf: it dispatches a handler that
 * animates a two-cell sprite blinker (0x694D/0x694E) and eventually advances the game
 * sub-state. So it is validated by MEMORY-equivalence against the frozen oracle
 * (RAM − STACK_SCRATCH, pc, SP), never the full register file and never cycles, with a
 * FRESH clone per case, using CRAFTED entries (doc-06: a real state + a surgical poke):
 *
 *   1. FULL-HANDLER (crafted reachable arms) — take a real attract-run machine, poke the
 *      phase 0x639D to each reachable index (0, 1, 2) and open the 0x6009 tick gate so the
 *      arm's body actually runs, and run the ORACLE on one clone and loc_127f on another.
 *      The FULL oracle arm handler runs on BOTH sides, so a wrong target OR a live
 *      register/flag handoff the folded-away trampoline would have supplied surfaces as
 *      divergent RAM. Proven non-vacuous: each arm mutates RAM vs the untouched base.
 *
 *   2. CRAFTED (exhaustive selector sweep) — the off-table indices the game never reaches
 *      (the table has 3 real slots + one 0x0000, and the selector is NOT range-checked). On
 *      a real captured base, poke 0x639D to every byte 0..255 identically on both sides and
 *      route ANY computed target to an IDENTICAL catch-all stub (so the handler never runs),
 *      then compare the target the dispatcher handed the stub + SP. This exhaustively pins
 *      the `0x1283 + (2*sel & 0xff)` 8-bit-wrap table math, including the wrap region
 *      sel >= 0x80, and the 0x0000 (index 3) slot.
 *
 *   3. TEETH — a twin that forms the offset as a full 16-bit `2*sel` (skipping the 8-bit
 *      `add a,a` wrap) MUST be caught by the selector sweep at sel >= 0x80.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-127f.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_127f as oracle } from "../../translated/loc_127f.js";
import { loc_127f } from "../loc_127f.js";
import { loc_00ca } from "../../translated/loc_00ca.js";
import { Machine } from "../../machine.js";
import { STACK_SCRATCH } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const PHASE = 0x639d;         // the sequence-phase selector
const GATE = 0x6009;          // rst 0x18 tick gate; = 1 makes the next tick expire
const PHASE_TABLE = 0x1283;   // ROM inline jump table base
const DISPATCH_TABLE_1283 = "0x1283 (0x639D dispatch)";
const hx = (v) => "0x" + (v & 0xffff).toString(16);

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

// A real, self-consistent machine: boot + a stretch of attract so work RAM (the sprite
// record 0x694D/0x694E, the player index 0x600E, the object scratch the arms touch) holds
// realistic values. loc_127f is never dispatched here — we craft its entry by poking.
function attractBase(frames = 180) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone(); // clone neutralises the frame machinery (nextNmi/nextBoundary = Infinity)
}

// Stamp a crafted dispatch entry onto a clone: a deep stack with a plausible caller return
// (so the arm's terminal `ret` has a sane target), the phase, and an open tick gate.
function craftEntry(base, phase, gateOpen = true) {
  const m = base.clone();
  m.regs.sp = 0x6c00;
  m.push16(0x4d5e);              // caller return, exactly as boot.test.js frames it
  m.mem.write8(PHASE, phase);
  if (gateOpen) m.mem.write8(GATE, 0x01); // rst 0x18 will decrement 1 -> 0 and run the body
  return m;
}

// -- 1. FULL-HANDLER (crafted reachable arms) ---------------------------------

test("FULL-HANDLER: loc_127f == oracle on real bases poked to each reachable phase (0,1,2)", () => {
  const base = attractBase();
  const REACHABLE = [0x00, 0x01, 0x02];

  let mutatedAny = false;
  for (const phase of REACHABLE) {
    const a = craftEntry(base, phase); // oracle
    const b = craftEntry(base, phase); // candidate
    const before = a.dumpState();

    oracle(a);
    loc_127f(b);

    const ramDiff = firstRamDiffExStack(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
    assert.equal(
      ramDiff,
      null,
      ramDiff && `RAM diverged at ${hx(ramDiff.addr)}: oracle=${ramDiff.a} cand=${ramDiff.b} ` +
        `(phase ${hx(phase)})`,
    );
    assert.equal(b.regs.sp, a.regs.sp, `SP diverged (phase ${hx(phase)}): oracle=${hx(a.regs.sp)} cand=${hx(b.regs.sp)}`);
    assert.equal(b.pc, a.pc, `pc diverged (phase ${hx(phase)}): oracle=${hx(a.pc)} cand=${hx(b.pc)}`);

    // Non-vacuous: the arm body actually ran and wrote RAM (else the replay proves nothing).
    if (firstRamDiffExStack(before, a.dumpState(), (o) => a.stateOffsetToAddr(o))) mutatedAny = true;
  }
  assert.ok(mutatedAny, "no reachable arm mutated RAM — the gate was never open, replay is vacuous");
  console.log(`  FULL-HANDLER: phases {0x00,0x01,0x02} — full oracle arm run both sides, RAM(−stack)+pc+SP identical`);
});

// -- 2. CRAFTED (exhaustive selector sweep) -----------------------------------

// A catch-all override object (duck-typed like the Machine's overrides Map) that routes
// ANY computed target to `stub`, so the dispatched arm never runs and we can read the
// target the dispatcher formed. loc_00ca consults m.overrides first, and BOTH the
// oracle (via the rst-0x28 trampoline) and the candidate reach the same target through it.
function stubOverrides(rec) {
  const SENTINEL = 0x5a;
  return {
    has: () => true,
    get: (target) => (mm) => { rec.push({ target, sp: mm.regs.sp }); return SENTINEL; },
  };
}

// Run oracle and candidate on identically-poked clones for one selector; return the
// { target, sp } each handed the stub.
function runCraftedSelector(base, candidate, sel) {
  const mA = craftEntry(base, sel, /*gateOpen*/ false);
  const mB = craftEntry(base, sel, /*gateOpen*/ false);
  const recA = [], recB = [];
  mA.overrides = stubOverrides(recA);
  mB.overrides = stubOverrides(recB);
  oracle(mA);
  candidate(mB);
  return { recA, recB };
}

test("CRAFTED: loc_127f == oracle over all 256 selectors (0x1283 table)", () => {
  const base = attractBase();
  let count = 0;
  let mismatch = null;
  for (let sel = 0; sel < 256 && !mismatch; sel++) {
    const { recA, recB } = runCraftedSelector(base, loc_127f, sel);
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
  const sel = mem.read8(PHASE);
  const entry = (PHASE_TABLE + 2 * sel) & 0xffff; // BUG: no 8-bit wrap on the *2
  const target = mem.read8(entry) | (mem.read8((entry + 1) & 0xffff) << 8);
  loc_00ca(m, target, DISPATCH_TABLE_1283);
}

test("TEETH: the 16-bit-offset twin (no 8-bit wrap) is CAUGHT by the selector sweep", () => {
  const base = attractBase();
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
