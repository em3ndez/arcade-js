// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_1f83 -- the per-slot head of sub_1f72's object-slot scan
 * (ld a,(ix+0) ; dec a ; jp z 0x1f93 ; inc l x3 ; fall into loc_1f8d). Two arms,
 * COLLAPSED to one m.step each:
 *   - ACTIVE   (dec a == 0, Z): 33 t, tail-jump to loc_1f93 (0x1F93).
 *   - INACTIVE (dec a != 0):    45 t, fall through into loc_1f8d (0x1F8D).
 * See optimized/loc_1f83.js for the fold and the flag analysis. loc_1f83 writes NO
 * RAM -- its observable output is registers (A, L, F) + pc + the collapsed cycle total.
 *
 * REACHABILITY (measured, not assumed -- the oracle's "not wired" docstring is STALE).
 * loc_197a is dispatched from the NMI game-state gameplay path, and its cascade reaches
 * sub_1f72 -> loc_1f83. Probed: loc_1f83 dispatches 8160x over 1400 attract frames (first
 * entry ~frame 586, once the attract demo starts PLAYING 25m). So a whole-machine run
 * exercises it and the gate is NON-vacuous, over both arms.
 *
 * ATOMIC, so the STRICT byte-exact whole-machine gate is the right license (not the
 * convergent gate, which is for INTERRUPTIBLE collapses whose mistimed-NMI raster tear /
 * dead-stack PC false-fail the strict gate). Probed: every loc_1f83 entry occurs INSIDE
 * the NMI handler (io.nmiMask == 0 at 8160/8160; outside-NMI 0), where entry_0066 has
 * cleared the NMI mask so the interrupt cannot re-enter -- and the NMI's pushed PC never
 * lands in [0x1F83,0x1F93) nor anywhere in the SCC (0 landings over 1394 NMIs; all land
 * in the 0x02BD-0x0372 main-loop band). Both entry paths (sub_1f72's dispatch and
 * loc_1f8d's djnz) originate from that NMI cascade, so it is atomic on every call path.
 * A correct atomic collapse is therefore byte-exact here, confirmed by the strict gate
 * passing over an 8000+-invocation window. This matches the SCC neighbour loc_1f8d.
 *
 * Jobs: WHOLE-MACHINE strict EQUAL (+ invocation proof) and its cycle-total teeth; UNIT
 * EQUAL on the natural first entry and a register-VALUE teeth twin; FULL-BRANCH coverage
 * of BOTH arms from crafted identical-both-sides entries (EQUAL over RAM+regs+pc+SP AND
 * each arm's exact cycle TOTAL, callees stubbed to isolate loc_1f83's own charge); and a
 * dropped-charge cycle twin CAUGHT on EACH arm.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1f83 as translated_1f83 } from "../../translated/state0.js";
import { loc_1f83 as optimized_1f83 } from "../loc_1f83.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1f83;
const ACTIVE_TAIL = 0x1f93;   // loc_1f93, the active-slot direction dispatch
const INACTIVE_TAIL = 0x1f8d; // loc_1f8d, the loop tail we fall into
const ACTIVE_CYCLES = 33;     // ld a[19] + dec a[4] + jp z taken[10]
const INACTIVE_CYCLES = 45;   // ld a[19] + dec a[4] + jp z not-taken[10] + 3x inc l[4]

const FRAMES_WHOLE = 720; // past the ~f586 first dispatch, ~4000+ invocations; teeth diverge ~f588
const FRAMES_UNIT = 650;  // the unit host must run past the first dispatch (~f586) to capture it

const SLOT_BASE = 0x6700;   // sub_1f72's object table base (IX); ram.js SCRATCH_6700 -- kept hex
const SLOT_STRIDE = 0x0020; // DE: object record stride (unused by loc_1f83, set for fidelity)
const CURSOR = 0x6980;      // sub_1f72's parallel 4-byte-per-slot buffer cursor (HL)

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) ---------------

test("STRICT (whole-machine): collapsed loc_1f83 is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_1f83]]));
  const fired = r.invocations.get(TARGET);
  assert.ok(fired >= 1, `override at 0x${TARGET.toString(16)} never dispatched (invocations=${fired})`);
  assert.equal(
    r.equal,
    true,
    r.equal ? "" : `NOT byte-exact: frame ${r.frame} addr 0x${(r.addr ?? 0).toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
  console.log(`  STRICT: byte-exact over ${r.framesCompared} frames, fired ${fired}x (atomic collapse)`);
});

test("STRICT-TEETH (cycles): a wrong branch total forks the trajectory and is CAUGHT", () => {
  // The collapse's load-bearing invariant is total-cycle preservation. Charging the
  // INACTIVE arm 44 t instead of 45 shifts the frame's cycle budget -> the spin count
  // 0x6019 (PRNG entropy) and where a later NMI's pushed PC lands -> the trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    regs.a = regs.dec8(mem.read8(regs.ix & 0xffff));
    if (regs.fZ) { m.step(ACTIVE_TAIL, ACTIVE_CYCLES); return m.call(ACTIVE_TAIL); }
    regs.l = regs.inc8(regs.l);
    regs.l = regs.inc8(regs.l);
    regs.l = regs.inc8(regs.l);
    m.step(INACTIVE_TAIL, INACTIVE_CYCLES - 1); // DROPPED: 45 -> 44
    return m.call(INACTIVE_TAIL);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry) -----------------------------------------------

/** Capture the pristine machine the instant loc_1f83 is first entered (via m.call, deep in
 *  the NMI cascade). The snapshot override is wired at CONSTRUCTION so it fires however the
 *  routine is reached, then delegates to the oracle so the host run proceeds normally. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1f83(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const NATURAL_ENTRY = ROM_PRESENT ? captureEntry() : null;

/** Run oracle and `fn` on independent clones of `entry`; report the diff + contract.
 *  Both run the full SCC descent as ORACLE downstream (only loc_1f83 differs), so any
 *  divergence localizes to loc_1f83's own body. */
function runBoth(entry, fn) {
  const a = entry.clone();
  const b = entry.clone();
  translated_1f83(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic loc_1f83 matches translated in RAM + full register file + pc", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_1f83);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. A, L, F) + pc identical (natural entry)");
});

test("TEETH (unit, register value): dropping one `inc l` leaves L/F wrong and is CAUGHT", () => {
  // loc_1f83 writes no RAM, so its value teeth target a REGISTER: a twin that does only
  // TWO inc l on the inactive arm leaves L (and the inc flags) off by one -- CAUGHT in the
  // register diff. (The natural first entry takes the INACTIVE arm: fresh/empty slots.)
  const broken_dropIncL = (m) => {
    const { regs, mem } = m;
    regs.a = regs.dec8(mem.read8(regs.ix & 0xffff));
    if (regs.fZ) { m.step(ACTIVE_TAIL, ACTIVE_CYCLES); return m.call(ACTIVE_TAIL); }
    regs.l = regs.inc8(regs.l);
    regs.l = regs.inc8(regs.l); // BUG: only 2 inc l instead of 3
    m.step(INACTIVE_TAIL, INACTIVE_CYCLES);
    return m.call(INACTIVE_TAIL);
  };
  const r = runBoth(NATURAL_ENTRY, broken_dropIncL);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a dropped inc l -- it is worthless");
  console.log(`  TEETH/unit: caught -- diff at ${r.regs ? r.regs.reg : (r.ram ? "ram" : "pc/sp")}`);
});

// -- FULL-BRANCH COVERAGE (crafted identical-both-sides entries: both arms) -----

/**
 * Fresh machine seeded with sub_1f72's loop register contract, pointed at one object
 * record. `active` pokes (ix+0)=1 so the ACTIVE arm is taken (dec a -> 0 -> Z); left 0
 * (fresh RAM) it is the INACTIVE arm (dec 0 -> 0xFF, not zero). To measure loc_1f83's
 * OWN cycle total, both tail targets (0x1F93, 0x1F8D) are registered as zero-cost no-ops
 * so the collapsed charge is loc_1f83's alone (33 / 45 t), not the SCC descent's. loc_1f83
 * never pushes/rets, so SP is untouched; a valid SP is set only for realism.
 */
function seed({ active = false } = {}) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.regs.hl = CURSOR;
  m.regs.de = SLOT_STRIDE;
  m.regs.ix = SLOT_BASE;
  m.regs.b = 0x0a;
  if (active) m.mem.write8((SLOT_BASE + 0x00) & 0xffff, 1); // active-state byte == 1
  m.routines.set(ACTIVE_TAIL, () => {});   // isolate loc_1f83's own cycles
  m.routines.set(INACTIVE_TAIL, () => {});
  return m;
}

/** Prove one arm EQUAL (RAM + full register file + pc + SP) AND pin its exact cycle
 *  total against the oracle and against the structural constant `expectCycles`. */
function assertArm(label, opts, expectTail, expectCycles) {
  const a = seed(opts);
  const b = seed(opts);
  const ca0 = a.cycles, cb0 = b.cycles;
  translated_1f83(a);
  optimized_1f83(b);
  const dA = a.cycles - ca0, dB = b.cycles - cb0;

  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `${label}: RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.regs, b.regs);
  assert.equal(regs, null, regs ? `${label}: reg diff at ${regs.reg} (t ${regs.a} vs o ${regs.b})` : "");
  assert.equal(a.pc, b.pc, `${label}: pc must match`);
  assert.equal(a.regs.sp, b.regs.sp, `${label}: SP must match`);
  assert.equal(b.pc, expectTail, `${label}: must tail-transfer to 0x${expectTail.toString(16)}`);
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs collapsed ${dB} t)`);
  assert.equal(dA, expectCycles, `${label}: oracle total should be ${expectCycles} t (got ${dA})`);
  console.log(`  BRANCH/${label}: EQUAL -- pc=0x${b.pc.toString(16)}, A=0x${b.regs.a.toString(16)}, ` +
    `L=0x${b.regs.l.toString(16)}, ${dB} t == oracle ${dA} t`);
}

test("BRANCH (unit): ACTIVE arm -- (ix+0)==1, dec a -> Z -> tail-jump loc_1f93 (33 t)", () => {
  assertArm("active", { active: true }, ACTIVE_TAIL, ACTIVE_CYCLES);
  const m = seed({ active: true });
  optimized_1f83(m);
  assert.equal(m.regs.a, 0, "active arm: dec of 1 leaves A == 0");
  assert.ok(m.regs.fZ, "active arm: Z is set");
});

test("BRANCH (unit): INACTIVE arm -- (ix+0)!=1, dec a != 0 -> 3x inc l -> fall into loc_1f8d (45 t)", () => {
  assertArm("inactive", { active: false }, INACTIVE_TAIL, INACTIVE_CYCLES);
  const m = seed({ active: false });
  const l0 = m.regs.l;
  optimized_1f83(m);
  assert.equal(m.regs.l, (l0 + 3) & 0xff, "inactive arm: L advanced by 3 (in-page)");
  assert.equal(m.regs.a, 0xff, "inactive arm: dec of 0 leaves A == 0xFF");
});

test("BRANCH-TEETH (cycles): a dropped charge on EACH arm yields a wrong total and is CAUGHT", () => {
  // ACTIVE arm charged 32 instead of 33; INACTIVE arm charged 44 instead of 45.
  const droppedActive = (m) => {
    const { regs, mem } = m;
    regs.a = regs.dec8(mem.read8(regs.ix & 0xffff));
    if (regs.fZ) { m.step(ACTIVE_TAIL, ACTIVE_CYCLES - 1); return m.call(ACTIVE_TAIL); } // 33->32
    regs.l = regs.inc8(regs.l); regs.l = regs.inc8(regs.l); regs.l = regs.inc8(regs.l);
    m.step(INACTIVE_TAIL, INACTIVE_CYCLES); return m.call(INACTIVE_TAIL);
  };
  const droppedInactive = (m) => {
    const { regs, mem } = m;
    regs.a = regs.dec8(mem.read8(regs.ix & 0xffff));
    if (regs.fZ) { m.step(ACTIVE_TAIL, ACTIVE_CYCLES); return m.call(ACTIVE_TAIL); }
    regs.l = regs.inc8(regs.l); regs.l = regs.inc8(regs.l); regs.l = regs.inc8(regs.l);
    m.step(INACTIVE_TAIL, INACTIVE_CYCLES - 1); return m.call(INACTIVE_TAIL); // 45->44
  };
  for (const [label, twin, opts, want] of [
    ["active", droppedActive, { active: true }, ACTIVE_CYCLES],
    ["inactive", droppedInactive, { active: false }, INACTIVE_CYCLES],
  ]) {
    const a = seed(opts);
    const b = seed(opts);
    const ca0 = a.cycles, cb0 = b.cycles;
    translated_1f83(a);
    twin(b);
    const dA = a.cycles - ca0, dB = b.cycles - cb0;
    assert.equal(dA, want, `${label}: oracle total should be ${want} t`);
    assert.notEqual(dB, dA, `${label}: cycle-total assertion has no teeth`);
    assert.equal(dA - dB, 1, `${label}: the twin must drop exactly 1 t`);
    console.log(`  BRANCH-TEETH/${label}: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
  }
});
