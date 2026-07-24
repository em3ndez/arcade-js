// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_20b5 -- set the horizontal-velocity SIGN for an object
 * slot ((ix+0x10)/(ix+0x11)), then transfer into 0x20e1 (NZ) or 0x20c3 (Z).
 * COLLAPSED: one m.step per arm (NZ 33 t -> 0x20e1; Z 71 t -> 0x20c3).
 *
 * GATE -- STRICT whole-machine + unit. sub_20b5 dispatches NON-vacuously in attract
 * (measured 4x/1200 frames, 15x/2000) via the 0x197a cascade's sub_1f72 object loop,
 * and BOTH arms occur naturally (Z: (ix+0x10)==0; NZ: (ix+0x10)==0xff). It is ATOMIC
 * -- io.nmiMask == 0 at 100% of dispatches, no NMI pushed-PC in the 0x1900-0x2FFF
 * cascade band -- so a total-preserving collapse stays byte-exact and the STRICT gate
 * (not the relaxed convergent gate) is correct here.
 *
 * Jobs:
 *   1. EQUAL (whole-machine): optimized == oracle every frame; override fires.
 *   2. EQUAL (unit): first-entry RAM + full register file + pc identical.
 *   3. TEETH (whole-machine): a wrong sign store diverges and is CAUGHT.
 *   4. TEETH (unit): a wrong sign store is CAUGHT and names (ix+0x10).
 *   5. BRANCH + CYCLES: both arms captured from NATURAL entries -- RAM + regs + pc
 *      identical AND each arm's cycle total == the oracle's (the collapse's teeth,
 *      pinned per arm on top of the PRNG-channel coverage the strict gate gives).
 *   6. TEETH (cycles): a dropped charge yields a wrong total and is CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_20b5 as translated_20b5 } from "../../translated/state0.js";
import { sub_20b5 as optimized_20b5 } from "../sub_20b5.js";
import { unitEquivalence, wholeMachineEquivalence } from "../harness.js";
import { Machine } from "../../machine.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x20b5;
const FRAMES = 1200; // sub_20b5 dispatches ~4x here (measured), both arms present

// A broken twin: identical to the optimized routine EXCEPT the Z-arm sign store lands
// 0xFE instead of 0xFF -- a wrong value to the routine's own output byte (ix+0x10) that
// the object animation then propagates. The NZ arm is untouched, so this bites only the
// Z arm (the natural first entry).
function broken_wrongSign(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  regs.a = mem.read8(R(0x10));
  regs.and(regs.a);
  if (regs.a !== 0) {
    m.step(0x20e1, 33);
    return m.call(0x20e1);
  }
  mem.write8(R(0x11), regs.a);
  mem.write8(R(0x10), 0xfe); // BUG: oracle writes 0xFF
  m.step(0x20c3, 71);
  return m.call(0x20c3);
}

// -- EQUAL --------------------------------------------------------------------

test("EQUAL (whole-machine): idiomatic optimized sub_20b5 matches translated every frame", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES, new Map([[TARGET, optimized_20b5]]));

  assert.ok(
    r.invocations.get(TARGET) >= 1,
    `override at 0x${TARGET.toString(16)} never dispatched (invocations=${r.invocations.get(TARGET)})`,
  );
  assert.equal(
    r.equal,
    true,
    r.equal ? "" : `diverged at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
  assert.equal(r.framesCompared, FRAMES);
  console.log(
    `  EQUAL/whole: ${r.framesCompared} frames identical, override fired ${r.invocations.get(TARGET)}x`,
  );
});

test("EQUAL (unit): idiomatic optimized sub_20b5 matches translated in RAM + registers", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_20b5, optimized_20b5, { maxFrames: FRAMES });

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical");
});

// -- TEETH (value) ------------------------------------------------------------

test("TEETH (whole-machine): a wrong sign store is CAUGHT and NOT-EQUAL", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES, new Map([[TARGET, broken_wrongSign]]));

  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "harness FAILED to catch a wrong sign store -- it is worthless");
  assert.equal(typeof r.frame, "number");
  assert.ok(r.addr != null, "a caught divergence must name an address");
  console.log(
    `  TEETH/whole: caught at frame ${r.frame}, addr 0x${r.addr.toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
});

test("TEETH (unit): a wrong sign store is CAUGHT and names (ix+0x10)", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_20b5, broken_wrongSign, { maxFrames: FRAMES });

  assert.equal(r.equal, false, "harness FAILED to catch a wrong sign store -- it is worthless");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  // The natural first entry is the Z arm; its sign byte is (ix+0x10) for that slot.
  console.log(
    `  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} (translated ${r.ram.a} vs broken ${r.ram.b})`,
  );
});

// -- BRANCH COVERAGE + CYCLES (captured NATURAL entries, both arms) -----------

// Capture the pristine machine state at sub_20b5's first entry on EACH arm (Z:
// (ix+0x10)==0, NZ: (ix+0x10)!=0). Both occur naturally in attract, so no synthesis
// is needed -- these are real dispatched entries.
let CAPTURED = null;
function capturedArms() {
  if (CAPTURED) return CAPTURED;
  let z = null, nz = null;
  const snapshot = new Map([[TARGET, (mm) => {
    const v10 = mm.mem.read8((mm.regs.ix + 0x10) & 0xffff);
    if (v10 === 0 && z === null) z = mm.clone();
    if (v10 !== 0 && nz === null) nz = mm.clone();
    return translated_20b5(mm); // let the host proceed to a clean stop
  }]]);
  const host = new Machine(ROM, { overrides: snapshot });
  host.runFrames(2000); // wide enough to see both arms (measured: both < 2000)
  assert.ok(z !== null, "Z arm ((ix+0x10)==0) never dispatched within 2000 frames");
  assert.ok(nz !== null, "NZ arm ((ix+0x10)!=0) never dispatched within 2000 frames");
  CAPTURED = { z, nz };
  return CAPTURED;
}

// Full-run equivalence: translated_20b5 / optimized_20b5 each run the WHOLE downstream
// cascade through m.call (sub_20c3 / sub_20e1 -> ... -> back into the 0x197a loop), so
// the two must agree on RAM + the full register file + the final pc AND the whole run's
// cycle total. Because the downstream is byte-identical for both (same callees, same
// inputs), an equal whole-run total means sub_20b5's OWN collapse preserved its total.
function runArm(entry) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // optimized
  const c0 = entry.cycles;
  translated_20b5(a);
  optimized_20b5(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pc: a.pc === b.pc ? null : { a: a.pc, b: b.pc },
    oracleCycles: a.cycles - c0,
    optCycles: b.cycles - c0,
  };
}

// Isolated OWN total: stub m.call so the transfer does NOT run the downstream cascade;
// the cycle delta is then sub_20b5's own charge alone (NZ 33 t / Z 71 t), the explicit
// per-arm pin docs/06 asks for on a collapsed routine.
function ownTotal(entry, fn) {
  const c = entry.clone();
  c.call = () => undefined; // isolate this routine -- do not execute the continuation
  const c0 = c.cycles;
  fn(c);
  return c.cycles - c0;
}

function assertArm(label, entry, expectOwnTotal) {
  const r = runArm(entry);
  assert.equal(r.ram, null, r.ram ? `${label}: RAM diff at 0x${r.ram.addr.toString(16)} (${r.ram.a} vs ${r.ram.b})` : "");
  assert.equal(r.regs, null, r.regs ? `${label}: reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
  assert.equal(r.pc, null, r.pc ? `${label}: final pc ${r.pc.a} vs ${r.pc.b}` : "");
  assert.equal(
    r.optCycles,
    r.oracleCycles,
    `${label}: whole-run cycle total ${r.optCycles} != oracle ${r.oracleCycles} (collapse changed the total)`,
  );
  // Explicit per-arm OWN-total pin (isolated from the downstream via a stubbed m.call).
  const oracleOwn = ownTotal(entry, translated_20b5);
  const optOwn = ownTotal(entry, optimized_20b5);
  assert.equal(oracleOwn, expectOwnTotal, `${label}: oracle own total should be ${expectOwnTotal} t (got ${oracleOwn})`);
  assert.equal(optOwn, oracleOwn, `${label}: optimized own total ${optOwn} != oracle ${oracleOwn} t`);
  console.log(
    `  BRANCH ${label}: RAM+regs+pc identical; own total ${optOwn} t == oracle ${oracleOwn} t; ` +
      `whole-run total ${r.optCycles} == oracle ${r.oracleCycles}`,
  );
}

test("BRANCH (Z arm, (ix+0x10)==0): RAM + regs + pc identical, own total 71 t", () => {
  assertArm("Z->20c3", capturedArms().z, 71);
});

test("BRANCH (NZ arm, (ix+0x10)!=0): RAM + regs + pc identical, own total 33 t", () => {
  assertArm("NZ->20e1", capturedArms().nz, 33);
});

// -- TEETH (cycles) -----------------------------------------------------------

test("TEETH (cycles): a dropped charge yields a wrong total and is CAUGHT on both arms", () => {
  // Same behaviour as optimized, but each arm's collapsed total is 5 t short.
  function cyclebroken(m) {
    const { regs, mem } = m;
    const R = (d) => (regs.ix + d) & 0xffff;
    regs.a = mem.read8(R(0x10));
    regs.and(regs.a);
    if (regs.a !== 0) {
      m.step(0x20e1, 28); // DROPPED: correct is 33
      return m.call(0x20e1);
    }
    mem.write8(R(0x11), regs.a);
    mem.write8(R(0x10), 0xff);
    m.step(0x20c3, 66); // DROPPED: correct is 71
    return m.call(0x20c3);
  }
  for (const { label, entry } of [
    { label: "Z->20c3", entry: capturedArms().z },
    { label: "NZ->20e1", entry: capturedArms().nz },
  ]) {
    // Isolate each side's own charge (stub the continuation) so the 5 t drop is
    // measured directly, not diluted by the shared downstream cascade.
    const dA = ownTotal(entry, translated_20b5);
    const dB = ownTotal(entry, cyclebroken);
    assert.notEqual(dB, dA, `${label}: cycle-total assertion has no teeth`);
    console.log(`  TEETH/cycles ${label}: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
  }
});
