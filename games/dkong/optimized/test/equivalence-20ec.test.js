// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for branch_20ec -- one of sub_1f72's per-slot object branches
 * (dispatched from loc_1f93 @ 0x1F97, `jp z,0x20ec`). It does: exx; call 0x239c
 * (gravity); a PROXIMITY/LIMIT gate (A=(H-0x1a) <u (ix+0x19)) -> loc_2104; else
 * call 0x2a2f (collision) and `and a`: NZ -> entry_2118, Z -> loc_2101.
 *
 * COLLAPSED: the two straight-line blocks fold into one m.step per arm (EXACT oracle
 * totals 65/96/91 t), with the two CALL boundaries (0x239c, 0x2a2f) kept verbatim.
 * See optimized/branch_20ec.js for the fold accounting, the flag/register analysis,
 * and the reachability/atomicity measurement.
 *
 * GATE = STRICT whole-machine (byte-exact), licensed because branch_20ec is ATOMIC
 * -- MEASURED here, not assumed. Over an all-oracle attract run it is dispatched 177x
 * by frame 900 (first at ~613, once the demo starts PLAYING 25m), EVERY entry inside
 * the NMI with the mask CLEARED (in-NMI 177/177, mask-set 0/0), and the NMI's pushed
 * PC never lands in [0x20EC,0x2100] (0 landings / 900 frames) -- so the collapse
 * pushes no mistimed PC and the strict gate is exact (same evidence class as loc_21ba,
 * the sibling in this cascade). All three arms fire naturally in attract (arm1=140,
 * arm2=6, arm3=31 over 900 frames), so the whole-machine gate is NON-vacuous on every
 * arm; each collapsed arm's exact total is ALSO pinned by a crafted cycle test below.
 *
 * Jobs: WHOLE-MACHINE strict EQUAL (+ invocation proof) and a cycle-total teeth
 * (a dropped arm-1 charge forks the PRNG -> caught); UNIT EQUAL on the natural first
 * entry (full downstream cascade) and behavioural teeth (an inverted gate takes the
 * wrong arm -> caught); and CRAFTED per-arm coverage (arm1/arm2/arm3 EQUAL over
 * RAM+regs+pc+SP AND the exact 65/96/91 t totals, callees+tails stubbed to isolate
 * branch_20ec's own effect) with a dropped-charge cycle twin CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { branch_20ec as translated_20ec } from "../../translated/state0.js";
import { branch_20ec as optimized_20ec } from "../branch_20ec.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x20ec;
const FRAMES_WHOLE = 720; // past the ~f613 first dispatch: ~109 invocations, all 3 arms
const FRAMES_UNIT = 650; // the unit host must run past the first dispatch (~f613)

// Object-record base + limit field for the crafted arms.
const IX = 0x6600;
const LIMIT_FIELD = 0x19; // (ix+0x19) -- the proximity gate's limit byte
const LIMIT_VAL = 0x40; // arm1: (H-0x1a) <u this ; arm2/3: not

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) ---------------

test("STRICT (whole-machine): collapsed branch_20ec is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_20ec]]));
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

test("STRICT-TEETH (cycles): a wrong arm-1 total forks the trajectory and is CAUGHT", () => {
  // The collapse's load-bearing invariant is per-arm total-cycle preservation.
  // Charging arm 1 (jp c -> loc_2104, the hot arm) 43 t instead of 44 shifts the
  // frame's cycle budget -> the spin count 0x6019 (PRNG entropy) and where a later
  // NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    const record = (off) => (regs.ix + off) & 0xffff;
    regs.exx();
    m.step(0x20ed, 4);
    m.push16(0x20f0); m.step(0x239c, 17); m.call(0x239c);
    regs.a = regs.h; regs.sub(0x1a); regs.b = mem.read8(record(0x19)); regs.cp(regs.b);
    if (regs.fC) { m.step(0x2104, 43); return m.call(0x2104); } // DROPPED: 44 -> 43
    m.step(0x20fa, 44);
    m.push16(0x20fd); m.step(0x2a2f, 17); m.call(0x2a2f);
    regs.and(regs.a);
    if (regs.fNZ) { m.step(0x2118, 14); return m.call(0x2118); }
    m.step(0x2101, 9); return m.call(0x2101);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry) -----------------------------------------------

/** Capture the pristine machine the instant branch_20ec is first entered (via m.call,
 *  deep in the loc_197a NMI cascade). The snapshot override is wired at CONSTRUCTION so
 *  it fires however the routine is reached, then delegates to the oracle so the host run
 *  proceeds normally. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_20ec(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const NATURAL_ENTRY = ROM_PRESENT ? captureEntry() : null;

/** Run oracle and `fn` on independent clones of `entry`; report the diff. Both sides run
 *  the identical downstream cascade (0x239c/0x2a2f + loc_2104/entry_2118/loc_2101 and the
 *  rest of the object scan) through the SAME oracle registry, so any diff localizes to
 *  branch_20ec's own effect on the shared entry state. */
function runBoth(entry, fn) {
  const a = entry.clone();
  const b = entry.clone();
  translated_20ec(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic branch_20ec matches translated in RAM + full register file + pc", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_20ec);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. F, A, B, shadow set) + pc + SP identical (natural entry)");
});

test("TEETH (unit behavioural): an inverted proximity gate takes the wrong arm and is CAUGHT", () => {
  // Identical to the optimized routine EXCEPT the `jp c` sense is inverted, so the
  // captured entry is routed down the OTHER arm (loc_2104 vs the 0x2a2f/collision path).
  // A different downstream cascade runs -> observable RAM/reg divergence.
  const broken = (m) => {
    const { regs, mem } = m;
    const record = (off) => (regs.ix + off) & 0xffff;
    regs.exx();
    m.step(0x20ed, 4);
    m.push16(0x20f0); m.step(0x239c, 17); m.call(0x239c);
    regs.a = regs.h; regs.sub(0x1a); regs.b = mem.read8(record(0x19)); regs.cp(regs.b);
    if (!regs.fC) { m.step(0x2104, 44); return m.call(0x2104); } // BUG: inverted gate
    m.step(0x20fa, 44);
    m.push16(0x20fd); m.step(0x2a2f, 17); m.call(0x2a2f);
    regs.and(regs.a);
    if (regs.fNZ) { m.step(0x2118, 14); return m.call(0x2118); }
    m.step(0x2101, 9); return m.call(0x2101);
  };
  const r = runBoth(NATURAL_ENTRY, broken);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a wrong-arm branch -- it is worthless");
  console.log(`  TEETH/unit: caught -- ${r.regs ? "reg diff at " + r.regs.reg : (r.ram ? "RAM diff at 0x" + (r.ram.addr).toString(16) : "pc/sp")}`);
});

// -- CRAFTED PER-ARM COVERAGE (isolated: callees + tails stubbed) --------------
//
// branch_20ec tail-jumps into the rest of the object cascade. To ISOLATE its own effect
// and pin each arm's exact OWN cycle total, the crafted machine stubs the two callees
// (0x239c gravity, 0x2a2f collision) and the three tail targets (0x2104/0x2118/0x2101)
// to controlled no-ops -- applied IDENTICALLY to the oracle and optimized sides. The
// 0x239c stub sets H to steer the proximity gate; the 0x2a2f stub sets A to steer the
// collision branch. Stubs charge no cycles, so the measured delta is branch_20ec's own
// total (65/96/91 t), the mandatory pin for a collapsed routine whose arms a
// whole-machine run covers only implicitly.

/** arm: 1 (jp c -> loc_2104), 2 (collision -> entry_2118), 3 (fall-through -> loc_2101). */
function stubs(arm) {
  const H = arm === 1 ? 0x20 : 0x80; // arm1: (0x20-0x1a)=0x06 <u 0x40 -> carry; else 0x66, no carry
  const A2a2f = arm === 2 ? 0x05 : 0x00; // arm2: NZ ; arm3: Z
  return new Map([
    [0x239c, (mm) => { mm.regs.h = H; }],
    [0x2a2f, (mm) => { mm.regs.a = A2a2f; }],
    [0x2104, () => {}],
    [0x2118, () => {}],
    [0x2101, () => {}],
  ]);
}

function seed(arm) {
  const m = new Machine(ROM, { overrides: stubs(arm) });
  m.regs.sp = 0x6c00;
  m.regs.ix = IX;
  m.mem.write8((IX + LIMIT_FIELD) & 0xffff, LIMIT_VAL);
  return m;
}

const ARMS = [
  { arm: 1, name: "jp c -> loc_2104 (proximity gate)", pc: 0x2104, total: 65 },
  { arm: 2, name: "collision -> entry_2118 (jp nz)", pc: 0x2118, total: 96 },
  { arm: 3, name: "fall-through -> loc_2101 (jp z)", pc: 0x2101, total: 91 },
];

/** Prove one arm EQUAL (RAM + full register file + pc + SP) AND pin its exact cycle
 *  total against the oracle and against the structural constant (65/96/91 t). */
function assertArm({ arm, name, pc, total }) {
  const a = seed(arm);
  const b = seed(arm);
  const ca0 = a.cycles, cb0 = b.cycles;
  translated_20ec(a);
  optimized_20ec(b);
  const dA = a.cycles - ca0, dB = b.cycles - cb0;

  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `arm${arm}: RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.regs, b.regs);
  assert.equal(regs, null, regs ? `arm${arm}: reg diff at ${regs.reg}` : "");
  assert.equal(a.pc, b.pc, `arm${arm}: pc must match`);
  assert.equal(a.regs.sp, b.regs.sp, `arm${arm}: SP must match`);
  assert.equal(b.pc, pc, `arm${arm}: lands at 0x${pc.toString(16)}`);
  assert.equal(dB, dA, `arm${arm}: cycle total mismatch (oracle ${dA} t vs collapsed ${dB} t)`);
  assert.equal(dA, total, `arm${arm}: oracle total should be ${total} t (got ${dA})`);
  console.log(`  ARM${arm}/${name}: EQUAL -- pc=0x${b.pc.toString(16)}, ${dB} t == oracle ${dA} t (== ${total})`);
}

for (const spec of ARMS) {
  test(`ARM ${spec.arm} (crafted): ${spec.name} -- EQUAL + exact ${spec.total} t total`, () => {
    assertArm(spec);
  });
}

test("ARM-TEETH (cycles): a dropped prologue charge yields a wrong total and is CAUGHT", () => {
  // Same behaviour as optimized on arm 1, but the exx charge is dropped (4 -> 0), so the
  // collapsed total is 4 t short of the oracle's 65.
  const dropped = (m) => {
    const { regs, mem } = m;
    const record = (off) => (regs.ix + off) & 0xffff;
    regs.exx();
    m.step(0x20ed, 0); // DROPPED: exx should be 4 t
    m.push16(0x20f0); m.step(0x239c, 17); m.call(0x239c);
    regs.a = regs.h; regs.sub(0x1a); regs.b = mem.read8(record(0x19)); regs.cp(regs.b);
    if (regs.fC) { m.step(0x2104, 44); return m.call(0x2104); }
    m.step(0x20fa, 44);
    m.push16(0x20fd); m.step(0x2a2f, 17); m.call(0x2a2f);
    regs.and(regs.a);
    if (regs.fNZ) { m.step(0x2118, 14); return m.call(0x2118); }
    m.step(0x2101, 9); return m.call(0x2101);
  };
  const a = seed(1);
  const b = seed(1);
  const ca0 = a.cycles, cb0 = b.cycles;
  translated_20ec(a);
  dropped(b);
  const dA = a.cycles - ca0, dB = b.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  ARM-TEETH: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});
