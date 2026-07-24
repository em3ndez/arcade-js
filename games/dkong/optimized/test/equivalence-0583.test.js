// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for loop_0583 (expand packed-BCD bytes into on-screen
 * digits). ROM 0x0583-0x0592. A shared loop with three entry points: draw_0578 /
 * draw_056b fall in with B = 3 (a 3-byte score), and sub_0616 TAIL-JUMPS in with
 * B = 1 (the single credits byte). It is reached only via `m.call` / a tail jump,
 * never as a dispatch target — the construction-time override the harness installs
 * resolves those `m.call`s, so the standard `unitEquivalence` reaches it.
 *
 * COLLAPSED (one m.step per basic block within each loop iteration); the
 * whole-machine gate is the CONVERGENT one, not strict -- "atomic" is a property of
 * the SCENARIO you happened to test, not of the routine, so a strict pass on one
 * short attract run would be a brittle false guarantee that could later false-fail
 * on a benign tear under a different one (loop_0583 is NOT atomic on either call
 * path: sub_0616's tail jump sits on the same frame-6 chain that INTERRUPTS
 * handler_05e9 mid-loop, and the in-game draw_0578/draw_056b path's djnz is
 * data-dependent, up to 256 trips). The convergent gate still catches everything
 * that actually matters (a wrong cycle total, a wrong memory op, a forked PRNG) as
 * a PERSISTENT divergence.
 *
 * Jobs:
 *   1. CONVERGENT (whole-machine) -- optimized loop_0583 CONVERGES against its
 *      oracle over the attract run (pixels + persistent non-stack state). The
 *      natural boot run dispatches it with B = [3, 3, 1], so the gate exercises
 *      BOTH the loop-many (B=3, score) and loop-once (B=1, credits) paths for real.
 *   2. EQUAL (unit) -- RAM + full register file (incl. F) + pc identical on the
 *      first captured entry (B = 3).
 *   3. BRANCH COVERAGE (unit, synthesised) -- loop 1 (immediate djnz-exit) / 2 / 3
 *      each proven EQUAL, with cycle TOTALS also asserted equal. The B = 0 -> 256
 *      djnz-WRAP edge is EXEMPT: it never occurs (every caller passes B = 1 or 3)
 *      and cannot be synthesised — the digit pointer (IX stepping -32 per digit)
 *      walks out of mapped VRAM after ~90 trips and BOTH impls throw the same
 *      UnmappedAccess, so it exercises the memory map, not equivalence.
 *   4. TEETH (unit) -- a deliberately-broken twin (the routine's first digit store,
 *      done by its callee sub_0593 at (IX) = 0x7641, lands the wrong value) must be
 *      CAUGHT and name the address.
 *   5. TEETH (convergent) -- a cycle-broken twin (Block A's charge 5 t short) forks
 *      the main loop's spin count (0x6019, the PRNG entropy): a PERSISTENT
 *      divergence, CAUGHT. (A value-corruption twin is not used here -- it would
 *      break a game invariant and could hang a long convergent run; that teeth
 *      stays at the fast unit level, job 4.)
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loop_0583 as translated_0583 } from "../../translated/mainloop.js";
import { loop_0583 as optimized_0583 } from "../loop_0583.js";
import { unitEquivalence } from "../harness.js";
import { Machine } from "../../machine.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";
import { convergentGate, SCENARIOS } from "./convergent.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x0583;
const FRAMES = 30; // loop_0583 dispatches 3x within 10 frames (B = [3, 3, 1])

// The routine's first digit store is done by its callee sub_0593 to (IX): the
// first dispatch is the high-score draw (draw_0578, IX = 0x7641), so the first
// write lands at VRAM 0x7641 — inside the compared dump (video RAM 0x7400-0x77FF).
const BROKEN_ADDR = 0x7641;

/**
 * Deliberately-broken twin: behaviourally optimized_0583 EXCEPT the first store
 * to 0x7641 (made inside sub_0593) lands a wrong value (correct XOR 0xFF, so it
 * always differs). Breaking exactly one of the routine's own output writes and
 * letting everything else — including every sub_0593 call — run verbatim is the
 * representative "wrong value to an output address" defect the gate must catch.
 */
function broken_0583(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (addr, value, busOffset) => {
    if (!broke && addr === BROKEN_ADDR) {
      broke = true;
      return realWrite(addr, value ^ 0xff, busOffset);
    }
    return realWrite(addr, value, busOffset);
  };
  try {
    return optimized_0583(m);
  } finally {
    m.mem.write8 = realWrite;
  }
}

// Cycle-broken twin for the CONVERGENT gate: identical memory + registers to the
// collapsed routine, but Block A's charge is 5 t short (23 -> 18). Block A runs on
// EVERY iteration (unconditional), so the drop always fires. A wrong total forks
// the main loop's spin count (0x6019, the PRNG entropy) -- a PERSISTENT divergence,
// never a heal. This is the teeth for the collapse's load-bearing invariant
// (total-cycle preservation); a value-corruption twin would break a game invariant
// and could hang a long convergent run, so the value teeth stays at the unit level
// (job 4 above).
const RENDER_DIGIT = 0x0593;
function cyclebroken_0583(m) {
  const { regs, mem } = m;
  do {
    regs.a = mem.read8(regs.hl);
    for (let i = 0; i < 4; i++) regs.rrca();
    m.step(0x0588, 18); // DROPPED: the correct charge here is 23 t
    m.push16(0x058b);
    m.step(RENDER_DIGIT, 17);
    m.call(RENDER_DIGIT);

    regs.a = mem.read8(regs.hl);
    m.step(0x058c, 7);
    m.push16(0x058f);
    m.step(RENDER_DIGIT, 17);
    m.call(RENDER_DIGIT);

    regs.hl = (regs.hl - 1) & 0xffff;
    regs.djnz();
    m.step(regs.b !== 0 ? 0x0583 : 0x0592, regs.b !== 0 ? 19 : 14);
  } while (regs.b !== 0);
  m.ret();
}

// Capture the pristine machine state at loop_0583's first entry (reached via
// m.call / tail jump), for the synthesised-branch coverage below.
function captureEntry(maxFrames = FRAMES) {
  let entry = null;
  const snap = (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_0583(mm); // let the host run proceed to a clean stop
  };
  const m = new Machine(ROM, { overrides: new Map([[TARGET, snap]]) });
  m.runFrames(maxFrames);
  if (entry === null) {
    throw new Error(`loop_0583 never dispatched within ${maxFrames} frames`);
  }
  return entry;
}

// Run one impl on a clone of the captured entry with B forced to `bVal`, counting
// the total cycles it charges (its own m.step + those of every callee).
function runWithB(entry, implFn, bVal) {
  const c = entry.clone();
  c.regs.b = bVal;
  let cyc = 0;
  const realStep = c.step.bind(c);
  c.step = (addr, t) => { cyc += t; return realStep(addr, t); };
  implFn(c);
  c.step = realStep;
  return { machine: c, cyc };
}

// -- EQUAL --------------------------------------------------------------------

test("CONVERGENT (whole-machine): collapsed loop_0583 CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_0583]]), { scenario: SCENARIOS.attract });

  assert.ok(
    r.invocations.get(TARGET) >= 1,
    `override at 0x${TARGET.toString(16)} never dispatched (invocations=${r.invocations.get(TARGET)})`,
  );
  assert.equal(
    r.pass,
    true,
    r.pass ? "" : `NOT convergent: persistent state ${JSON.stringify(r.statePersistent)}, ` +
      `pixelPersistent=${r.pixelPersistent}`,
  );
  console.log(
    `  CONVERGENT: pass, fired ${r.invocations.get(TARGET)}x (natural B = [3, 3, 1]: loop-many + loop-once); ` +
      `${r.pixDiffFrames} tear frame(s) (max ${r.maxPixels}px, healed), ` +
      `non-stack state persistent = ${r.statePersistent.length}`,
  );
});

test("EQUAL (unit): idiomatic optimized loop_0583 matches translated in RAM + registers", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_0583, optimized_0583);

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F, HL, IX) + pc identical (natural B = 3)");
});

// -- BRANCH COVERAGE (synthesised) --------------------------------------------

test("BRANCH COVERAGE (unit): loop 1 / 2 / 3 all EQUAL incl. cycle totals", () => {
  const entry = captureEntry();
  // B = 1 exercises the djnz taken=NO (immediate exit) branch; B = 2 and 3
  // exercise djnz taken=YES then not-taken (loop-many). The B = 0 -> 256 wrap is
  // exempt (see the file header): unreachable in the ROM and un-synthesisable
  // (the -32 digit pointer leaves mapped VRAM, both impls throw identically).
  const cases = [
    { b: 1, label: "1 (loop-once, credits)" },
    { b: 2, label: "2 (loop-twice)" },
    { b: 3, label: "3 (loop-many, score)" },
  ];
  for (const { b, label } of cases) {
    const a = runWithB(entry, translated_0583, b);
    const o = runWithB(entry, optimized_0583, b);
    const ram = firstStateDiff(a.machine.dumpState(), o.machine.dumpState(), (off) => a.machine.stateOffsetToAddr(off));
    const regs = firstRegDiff(a.machine.regs, o.machine.regs);
    assert.equal(ram, null, ram ? `B=${label}: RAM diff at 0x${(ram.addr ?? 0).toString(16)} (${ram.a} vs ${ram.b})` : "");
    assert.equal(regs, null, regs ? `B=${label}: reg diff at ${regs && regs.reg}` : "");
    assert.equal(a.machine.pc, o.machine.pc, `B=${label}: pc must match`);
    assert.equal(o.cyc, a.cyc, `B=${label}: cycle total must match (oracle ${a.cyc} vs optimized ${o.cyc})`);
  }
  // Report the totals for the record (per-instruction, so optimized == oracle).
  const t = (b) => runWithB(entry, translated_0583, b).cyc;
  console.log(
    `  BRANCH/unit: B=1 ${t(1)}t, B=2 ${t(2)}t, B=3 ${t(3)}t (+185t/trip) ` +
      "— each EQUAL (RAM+regs+pc) and cycle-total-equal oracle vs optimized",
  );
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_0583]]), { scenario: SCENARIOS.attract });

  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.pass, false, "convergent gate FAILED to catch a wrong cycle total -- it is worthless");
  assert.ok(
    r.statePersistent.length > 0 || r.pixelPersistent,
    "a caught divergence must be persistent (non-stack state or pixels)",
  );
  console.log(
    `  TEETH/convergent: caught -- persistent non-stack addrs ${r.statePersistent.length}` +
      `${r.statePersistent.length ? " (" + r.statePersistent.slice(0, 4).map((s) => "0x" + s.addr.toString(16)).join(",") + ")" : ""}, ` +
      `pixelPersistent ${r.pixelPersistent}`,
  );
});

test("TEETH (unit): a wrong digit store is CAUGHT and names 0x7641", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_0583, broken_0583);

  assert.equal(r.equal, false, "harness FAILED to catch a wrong store — it is worthless");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  assert.equal(
    r.ram.addr,
    BROKEN_ADDR,
    `expected first diff at the broken address 0x${BROKEN_ADDR.toString(16)}, got 0x${r.ram.addr.toString(16)}`,
  );
  console.log(
    `  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} (translated ${r.ram.a} vs broken ${r.ram.b})`,
  );
});
