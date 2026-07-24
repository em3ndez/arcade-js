// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for loc_2153 (clear three object-record fields, then
 * TAIL-JUMP into the shared object-sprite tail loc_21ba). A LEAF join point in the
 * sub_1f72 object-scan cluster -- not a dispatch target -- reached only via a tail
 * `jp 0x2153` from entry_2118 / loc_2146, which sub_1f72 dispatches from the
 * interruptible per-frame update cascade loc_197a (@0x1986) and during attract's
 * demo play. The unit gate reaches it because the snapshot override is installed at
 * CONSTRUCTION, so it fires however the routine is entered (dispatch OR m.call).
 *
 * Six jobs:
 *
 *   1. CONVERGENT (whole-machine) -- loc_2153 is COLLAPSED (one m.step for its whole
 *      straight-line block) and INTERRUPTIBLE, so the strict byte-exact gate would
 *      false-fail on a mistimed-NMI raster tear + the coarse PC pushed into the dead
 *      stack. The convergent gate is the correct license. It runs the ATTRACT
 *      scenario (the GAMEPLAY default does not reach this routine within 1200
 *      frames; attract's demo play dispatches it 6x at frames ~622-789).
 *
 *   2. DISPATCH -- the override must actually fire, or EQUAL is vacuous. loc_2153
 *      fires 6x in the attract window; the first natural entry (frame ~622) has
 *      IX=0x6700 (object slot 0, WORK RAM) and A=0 (both live callers `xor a` before
 *      the tail jump).
 *
 *   3. EQUAL (unit) -- translated vs optimized leave identical RAM + registers
 *      (incl. F, which `ld (ix+d),a` never writes, so it is carried through) + pc,
 *      from the captured natural entry. maxFrames=700 because the first entry is at
 *      frame ~622, past the unit gate's 240-frame default.
 *
 *   4. CONTRACT COVERAGE + CYCLE TOTAL -- loc_2153 has NO data-dependent branch (a
 *      single basic block), so there is one arm and nothing to synthesise for
 *      control flow. But the routine stores the LIVE A, not a hardcoded 0, so the
 *      arm is driven at A=0 (natural) AND A=0x5A on BOTH sides: RAM (all three
 *      fields take A) + regs + pc + SP identical, and the collapsed arm's CYCLE
 *      TOTAL equals the oracle's AND the pinned absolute 927 t (the routine's own
 *      67 t + the deterministic loc_21ba/loc_1f8d tail cascade, A-independent). A
 *      rewrite that wrote 0 instead of A is CAUGHT here (differs from the oracle at
 *      A=0x5A).
 *
 *   5. BRANCH-TEETH (cycles) -- a variant that drops 5 t from the block charge yields
 *      a wrong total (922 vs 927) and is CAUGHT, proving the cycle-total assertion
 *      has teeth.
 *
 *   6a. TEETH (convergent) -- a cycle-broken twin (5 t short) shifts the main loop's
 *       spin count 0x6019 (the PRNG entropy), forking the RANDOM stream PERMANENTLY;
 *       the convergent gate CATCHES it as a PERSISTENT non-stack divergence (verified:
 *       persistent at 0x6019 / 0x6018 + pixels).
 *   6b. TEETH (unit, value) -- a broken twin whose first store (to ix+0x14 = 0x6714)
 *       lands the wrong value (A XOR 0xFF) is CAUGHT: NOT-EQUAL, naming 0x6714.
 *
 * THE CYCLE DECISION this routine records: loc_2153 is COLLAPSED to ONE m.step. Its
 * four instruction charges (19+19+19+10 = 67 t, exit PC 0x21ba) fold into a single
 * charge; total-preservation keeps the spin count / PRNG deterministic. It is NOT
 * atomic (the NMI can land in its 67 t window via the loc_197a cascade / attract), so
 * the collapse is LICENSED by the CONVERGENT gate, not the strict one. All three
 * stores are WORK RAM (0x67xx; IX tops at 0x6820 (slot 9), so ix+0x14 tops at 0x6834) --
 * no 0x7Dxx hardware latch -- so there is NO hardware bus cycle to pin and NO
 * write-trace test.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2153 as translated_2153 } from "../../translated/state0.js";
import { loc_2153 as optimized_2153 } from "../loc_2153.js";
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

const TARGET = 0x2153;
const CAPTURE_FRAMES = 700; // first natural (attract) entry is at frame ~622
const PINNED_CYCLES = 927;  // loc_2153's own 67 t + the deterministic loc_21ba tail cascade

// The three object-record field OFFSETS the routine clears (IX-relative). At the
// natural entry IX=0x6700, so these resolve to 0x6714 / 0x6704 / 0x6706 in work RAM.
const FIELD_OFFSETS = [0x14, 0x04, 0x06];

/**
 * Deliberately-broken twin: behaviourally the optimized routine EXCEPT the first
 * store (to ix+0x14) lands a wrong value (A XOR 0xFF, guaranteed to differ). Catches
 * a "wrong value to the routine's own output field" bug.
 */
function broken_2153(m) {
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
    return optimized_2153(m);
  } finally {
    m.mem.write8 = realWrite;
  }
}

/**
 * Cycle-broken twin for the CONVERGENT gate: identical memory + registers to the
 * collapsed routine, but the block charge is 5 t short, so the path total no longer
 * matches the oracle. Wrong totals shift the spin count (0x6019, the PRNG entropy),
 * forking the RANDOM stream -- a PERSISTENT non-stack divergence (0x6019/0x6018 and
 * the sprites it drives), never a heal. Teeth for the collapse's load-bearing
 * invariant (total-cycle preservation).
 */
function cyclebroken_2153(m) {
  const { regs, mem } = m;
  const obj = regs.ix, value = regs.a;
  mem.write8((obj + 0x14) & 0xffff, value);
  mem.write8((obj + 0x04) & 0xffff, value);
  mem.write8((obj + 0x06) & 0xffff, value);
  m.step(0x21ba, 62); // DROPPED: the correct charge here is 67 t
  return m.call(0x21ba);
}

/** Capture the pristine machine the instant loc_2153 is first entered (via m.call).
 *  A constructor override snapshots the entry, then delegates to the translated
 *  oracle so the host run proceeds normally to a clean stop. */
function captureEntry(maxFrames = CAPTURE_FRAMES) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_2153(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}

/** Clone `entry`, set A := `fillA`, run `fn`, and report the full contract:
 *  the resulting SP + PC, the machine, and the cycles the routine charged (relative
 *  to entry, so it is base-independent). */
function runWithA(entry, fillA, fn) {
  const c = entry.clone();
  c.regs.a = fillA;
  const c0 = c.cycles;
  const ret = fn(c);
  return { ret, cycles: c.cycles - c0, sp: c.regs.sp, pc: c.pc, machine: c };
}

// -- EQUAL --------------------------------------------------------------------

test("CONVERGENT (whole-machine): collapsed loc_2153 CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  // loc_2153 is COLLAPSED and INTERRUPTIBLE; the ATTRACT scenario reaches it (the
  // GAMEPLAY default does not within 1200 frames).
  const r = convergentGate(new Map([[TARGET, optimized_2153]]), { scenario: SCENARIOS.attract });

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

test("EQUAL (unit): idiomatic optimized loc_2153 matches translated in RAM + registers", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_2153, optimized_2153, { maxFrames: CAPTURE_FRAMES });

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F, A, IX, SP) + pc identical (natural A=0 entry)");
});

// -- CONTRACT COVERAGE + CYCLE TOTAL -----------------------------------------

/** Prove the single arm EQUAL across the WHOLE contract at a chosen fill value A:
 *  RAM (all three fields := A), registers, pc, SP, and the collapsed cycle total
 *  (== oracle == pinned absolute). */
function assertContract(fillA) {
  const entry = captureEntry();
  const ix = entry.regs.ix;
  const o = runWithA(entry, fillA, translated_2153);
  const p = runWithA(entry, fillA, optimized_2153);

  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(o.machine.regs, p.machine.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(o.pc, p.pc, "pc must match between oracle and optimized");
  assert.equal(o.sp, p.sp, "SP must match the oracle");

  // The routine stores the LIVE A into all three fields -- a hardcoded 0 would be
  // caught by the oracle comparison above at A!=0; assert it directly too.
  for (const off of FIELD_OFFSETS) {
    assert.equal(
      p.machine.mem.read8((ix + off) & 0xffff), fillA,
      `field (ix+0x${off.toString(16)}) must equal A=0x${fillA.toString(16)}`,
    );
  }

  // Collapsed-arm cycle total: == oracle, and pinned absolute (structural teeth).
  assert.equal(o.cycles, p.cycles, "cycle total must match the oracle");
  assert.equal(o.cycles, PINNED_CYCLES, `oracle cycle total should be ${PINNED_CYCLES} t`);
  console.log(
    `  CONTRACT/A=0x${fillA.toString(16)}: EQUAL -- SP 0x${p.sp.toString(16)}, ${p.cycles} t, ` +
      `fields[0x6714/04/06] all = 0x${fillA.toString(16)}`,
  );
}

test("CONTRACT (unit): natural fill A=0 -- fields cleared, SP + cycle total 927 t", () => {
  assertContract(0x00);
});

test("CONTRACT (unit): synthesised fill A=0x5A -- stores LIVE A (not hardcoded 0), 927 t", () => {
  assertContract(0x5a);
});

test("BRANCH-TEETH (cycles): a dropped m.step charge yields a wrong total and is CAUGHT", () => {
  const entry = captureEntry();
  const good = runWithA(entry, 0x00, optimized_2153);
  const dropped = runWithA(entry, 0x00, cyclebroken_2153); // 5 t short
  assert.equal(good.cycles, PINNED_CYCLES, `the correct total is ${PINNED_CYCLES} t`);
  assert.notEqual(dropped.cycles, good.cycles, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH: correct ${good.cycles} t vs dropped-charge ${dropped.cycles} t -- caught`);
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  // The convergent gate tolerates transient tears but MUST catch a real (non-healing)
  // error. The collapse's load-bearing invariant is total-cycle preservation; a short
  // charge shifts the spin count 0x6019 (PRNG entropy), forking the RANDOM stream.
  const r = convergentGate(new Map([[TARGET, cyclebroken_2153]]), { scenario: SCENARIOS.attract });

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

test("TEETH (unit): a wrong (ix+0x14) store is CAUGHT and names 0x6714", () => {
  const entry = captureEntry();
  const expectedAddr = (entry.regs.ix + 0x14) & 0xffff; // 0x6714 at the natural entry

  const a = entry.clone();
  const b = entry.clone();
  translated_2153(a);
  broken_2153(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));

  assert.ok(ram != null, "harness FAILED to catch a wrong store -- it is worthless");
  assert.equal(
    ram.addr, expectedAddr,
    `expected first diff at the broken field 0x${expectedAddr.toString(16)}, got 0x${ram.addr.toString(16)}`,
  );
  console.log(`  TEETH/unit: caught at 0x${ram.addr.toString(16)} (translated ${ram.a} vs broken ${ram.b})`);
});
