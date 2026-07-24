// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for branch_1fef (ROM 0x1FEF): the "-X" (move-left)
 * velocity step for an active object. loc_1f93 rotates the object's direction byte
 * (ix+2) through `rra` and jumps here on the -X bit; this arm swaps in the shadow bank
 * (`exx`), loads the -X velocity vector BC := 0xFF04, steps the object X coordinate
 * (ix+3) DOWN by one, and FALLS THROUGH into the shared clamp/sprite tail shared_1ff6
 * (0x1ff6, the very next address). Its mirror twin branch_1fe5 is the +X arm (BC :=
 * 0x0100, `inc (ix+3)`, explicit `jp 0x1ff6`). sub_1f72 dispatches loc_1f93 from the
 * INTERRUPTIBLE per-frame update cascade loc_197a (@0x1986) and during attract's demo
 * play.
 *
 * branch_1fef is a straight-line, branch-free block, so there is exactly ONE path;
 * "full branch coverage" is that single collapsed arm, proven EQUAL in RAM + all
 * registers (incl. F) + pc AND in its collapsed cycle TOTAL (37 t + the identical
 * shared_1ff6 tail), with a non-vacuous output probe (shadow BC == 0xFF04 and ix+3
 * decremented).
 *
 * NOTE the 37 t (vs the +X twin's 47): branch_1fef has NO tail `jp` -- it falls straight
 * through into shared_1ff6 -- so there is no 10 t jump charge. exx[4] + ld bc[10] +
 * dec (ix+3)[23] = 37 t.
 *
 * Six jobs (mirroring equivalence-1fe5.test.js):
 *
 *   1. CONVERGENT (whole-machine) -- branch_1fef is COLLAPSED (one m.step for its whole
 *      block) and INTERRUPTIBLE, so the strict byte-exact gate would false-fail on a
 *      mistimed-NMI raster tear + the coarse PC pushed into the dead stack. The convergent
 *      gate is the correct license. The ATTRACT scenario dispatches it many times in 1200
 *      frames (first natural entry at frame ~751, when attract's demo play walks left).
 *   2. DISPATCH -- the override must actually fire or EQUAL is vacuous (asserted via the
 *      invocation counter).
 *   3. EQUAL (unit) -- translated vs optimized leave identical RAM + registers (incl. F,
 *      which `dec (ix+3)` sets and this rewrite reproduces) + pc, from the captured natural
 *      entry (full path, incl. the shared_1ff6 tail run as oracle on both sides).
 *   4. PATH (collapsed arm) + CYCLE TOTAL -- branch_1fef has NO data-dependent branch, so
 *      there is one arm. Because its tail shared_1ff6 is data-dependent (its total is NOT a
 *      fixed constant), the arm is proven at the tail transfer 0x1ff6 by an
 *      identical-both-sides BOUNDARY stub: oracle and optimized leave identical RAM + regs
 *      + pc at 0x1ff6, and the collapsed block charges the SAME cycle total == the oracle's
 *      == the exact 37 t. Non-vacuous: shadow BC == 0xFF04, ix+3 == old-1. A rewrite that
 *      forgot the `exx`/velocity or the X step is CAUGHT here.
 *   5. BRANCH-TEETH (cycles) -- a variant that charges 32 t (vs 37) for the block yields a
 *      wrong boundary total and is CAUGHT, proving the cycle-total assertion has teeth.
 *   6a. TEETH (convergent) -- the 32 t twin shifts the main-loop spin count 0x6019 (the
 *       PRNG entropy), forking the RANDOM stream PERMANENTLY; the convergent gate CATCHES
 *       it as a PERSISTENT non-stack divergence.
 *   6b. TEETH (unit, value) -- a broken twin whose store to ix+3 lands the wrong value
 *       (old XOR 0xFF) is CAUGHT: NOT-EQUAL, naming the object X field.
 *
 * THE CYCLE DECISION this routine records: branch_1fef is COLLAPSED to ONE m.step. Its
 * three instruction charges (exx[4] + ld bc[10] + dec (ix+3)[23] = 37 t, exit PC 0x1ff6)
 * fold into a single charge; total-preservation keeps the spin count / PRNG deterministic.
 * It is NOT atomic (the NMI can land in its 37 t window via the loc_197a cascade /
 * attract), so the collapse is LICENSED by the CONVERGENT gate, not the strict one. The
 * one write is the object field ix+3 (WORK RAM, 0x6723 in the live scan) -- no 0x7Dxx
 * hardware latch -- so there is NO hardware bus cycle to pin and NO write-trace test.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { branch_1fef as translated_1fef } from "../../translated/state0.js";
import { branch_1fef as optimized_1fef } from "../branch_1fef.js";
import { unitEquivalence } from "../harness.js";
import { convergentGate, SCENARIOS } from "./convergent.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";
import { Machine } from "../../machine.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1fef;
const TAIL = 0x1ff6;      // shared_1ff6, the tail this routine falls through into
const SLOT_X = 0x03;      // object X coordinate field offset (ix+3)
const BLOCK_CYCLES = 37;  // exx[4] + ld bc[10] + dec (ix+3)[23]  (NO jp -- falls through)
const MINUS_X = 0xff04;   // the -X velocity vector this arm loads into the shadow BC
const CAPTURE_FRAMES = 760; // first natural (attract) entry is at frame ~751 (demo play walks left)

/** Capture the pristine machine the instant branch_1fef is first entered (via m.call).
 *  A constructor override snapshots the entry, then delegates to the translated oracle
 *  so the host run proceeds normally. */
function captureEntry(maxFrames = CAPTURE_FRAMES) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1fef(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}

let ENTRY = null;
function entryOnce() {
  if (!ENTRY) ENTRY = captureEntry();
  return ENTRY;
}

/**
 * Run `fn` (an oracle/optimized/broken branch_1fef) from a clone of the captured entry,
 * but intercept the tail transfer so we observe branch_1fef's OWN boundary contract in
 * isolation -- the tail shared_1ff6 is data-dependent, so pinning an absolute full-path
 * total is meaningless; the collapsed BLOCK total (37 t) is not. The stub at 0x1ff6
 * returns without running the tail, so the machine is left exactly at the tail transfer:
 * pc == 0x1ff6, cycles == entry + 37, shadow BC == 0xFF04, mem[ix+3] == old-1, F == the
 * dec flags.
 */
function runToBoundary(entry, fn) {
  const c = entry.clone();
  const objX = (c.regs.ix + SLOT_X) & 0xffff;
  const oldX = c.mem.read8(objX);
  const c0 = c.cycles;
  c.routines.set(TAIL, () => undefined); // observe the boundary; do NOT run the tail
  fn(c);
  return { machine: c, objX, oldX, charged: c.cycles - c0, pc: c.pc };
}

/**
 * Deliberately-broken VALUE twin: behaviourally the optimized routine EXCEPT the first
 * store (the dec to ix+3) lands a wrong value (old XOR 0xFF, guaranteed to differ).
 * Catches a "wrong value to the routine's own output field" bug.
 */
function brokenValue(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (addr, value, busOffset) => {
    if (!broke) {
      broke = true;
      return realWrite(addr, value ^ 0xff, busOffset);
    }
    return realWrite(addr, value, busOffset);
  };
  try {
    return optimized_1fef(m);
  } finally {
    m.mem.write8 = realWrite;
  }
}

/**
 * Cycle-broken twin for the CONVERGENT gate: identical memory + registers to the
 * collapsed routine, but the block charge is 5 t short (32 vs 37), so the path total no
 * longer matches the oracle. Wrong totals shift the spin count (0x6019, the PRNG
 * entropy), forking the RANDOM stream -- a PERSISTENT non-stack divergence.
 */
function cyclebroken(m) {
  const { regs, mem } = m;
  regs.exx();
  regs.bc = MINUS_X;
  regs.decMem8(mem, (regs.ix + SLOT_X) & 0xffff);
  m.step(TAIL, BLOCK_CYCLES - 5); // DROPPED: the correct charge is 37 t
  return m.call(TAIL);
}

// -- EQUAL --------------------------------------------------------------------

test("CONVERGENT (whole-machine): collapsed branch_1fef CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  // branch_1fef is COLLAPSED and INTERRUPTIBLE; the ATTRACT scenario reaches it many
  // times in 1200 frames, so the convergent gate is the correct license.
  const r = convergentGate(new Map([[TARGET, optimized_1fef]]), { scenario: SCENARIOS.attract });

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
    `  CONVERGENT: pass, fired ${r.invocations.get(TARGET)}x; ` +
      `${r.pixDiffFrames} tear frame(s) (max ${r.maxPixels}px, healed), ` +
      `non-stack state persistent = ${r.statePersistent.length}`,
  );
});

test("EQUAL (unit): idiomatic optimized branch_1fef matches translated in RAM + registers", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_1fef, optimized_1fef, { maxFrames: CAPTURE_FRAMES });

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F from dec, BC shadow) + pc identical (natural entry)");
});

// -- SINGLE-ARM COVERAGE (boundary: EQUAL RAM + regs + pc + collapsed 37 t) -----

test("PATH (single arm): boundary state EQUAL + collapsed 37 t == oracle; -X velocity + X step happened", () => {
  const entry = entryOnce();
  const o = runToBoundary(entry, translated_1fef);
  const p = runToBoundary(entry, optimized_1fef);

  // Oracle vs optimized at the tail transfer: identical RAM + full register file + pc.
  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)} (t ${ram.a} vs o ${ram.b})` : "");
  const regs = firstRegDiff(o.machine.regs, p.machine.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg} (t ${regs.a} vs o ${regs.b})` : "");
  assert.equal(o.pc, p.pc, "pc must match at the tail transfer");
  assert.equal(p.pc, TAIL, "the block exits at the tail 0x1ff6");

  // Collapsed-arm cycle total: == oracle, and the exact block cost (structural teeth).
  assert.equal(p.charged, o.charged, "cycle total must match the oracle at the boundary");
  assert.equal(p.charged, BLOCK_CYCLES, `the collapsed block is ${BLOCK_CYCLES} t`);

  // Non-vacuous: the routine's distinctive effects survive at the boundary.
  assert.equal(p.machine.regs.bc, MINUS_X, "shadow BC must hold the -X velocity vector 0xff04");
  assert.equal(
    p.machine.mem.read8(p.objX), (p.oldX - 1) & 0xff,
    `object X (ix+3) must be decremented (${p.oldX} -> ${(p.oldX - 1) & 0xff})`,
  );
  console.log(
    `  PATH: EQUAL @0x1ff6 -- ${p.charged} t (== oracle), BC=0x${p.machine.regs.bc.toString(16)}, ` +
      `X 0x${p.oldX.toString(16)}->0x${p.machine.mem.read8(p.objX).toString(16)}`,
  );
});

test("BRANCH-TEETH (cycles): a 32 t (vs 37) block charge yields a wrong total and is CAUGHT", () => {
  const entry = entryOnce();
  const good = runToBoundary(entry, optimized_1fef);
  const dropped = runToBoundary(entry, cyclebroken); // 5 t short
  assert.equal(good.charged, BLOCK_CYCLES, `the correct total is ${BLOCK_CYCLES} t`);
  assert.notEqual(dropped.charged, good.charged, "cycle-total assertion has no teeth");
  assert.equal(good.charged - dropped.charged, 5, "the 5 t drop must be exactly the difference the twin injects");
  console.log(`  BRANCH-TEETH: correct ${good.charged} t vs dropped-charge ${dropped.charged} t -- caught`);
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  // The convergent gate tolerates transient tears but MUST catch a real (non-healing)
  // error. The collapse's load-bearing invariant is total-cycle preservation; a short
  // charge shifts the spin count 0x6019 (PRNG entropy), forking the RANDOM stream.
  const r = convergentGate(new Map([[TARGET, cyclebroken]]), { scenario: SCENARIOS.attract });

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

test("TEETH (unit, value): a wrong object-X store is CAUGHT and names ix+3", () => {
  const entry = entryOnce();
  const expectedAddr = (entry.regs.ix + SLOT_X) & 0xffff; // 0x6723 at the natural entry

  const o = runToBoundary(entry, translated_1fef);
  const b = runToBoundary(entry, brokenValue);
  const ram = firstStateDiff(o.machine.dumpState(), b.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));

  assert.ok(ram != null, "harness FAILED to catch a wrong store -- it is worthless");
  assert.equal(
    ram.addr, expectedAddr,
    `expected first diff at the broken field 0x${expectedAddr.toString(16)}, got 0x${ram.addr.toString(16)}`,
  );
  console.log(`  TEETH/unit: caught at 0x${ram.addr.toString(16)} (translated ${ram.a} vs broken ${ram.b})`);
});
