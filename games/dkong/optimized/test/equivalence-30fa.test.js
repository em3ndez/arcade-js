// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_30fa (read the animation-phase index 0x6380, clamp to 5, and
 * rst-0x28 tail-dispatch to the selected guard). Dispatches in a plain attract run (4
 * callers). Being read-and-dispatch, its teeth corrupt the 0x6380 read so a different
 * guard runs and the outcome diverges.
 *
 * COLLAPSED (one m.step per basic block); the whole-machine gate is the CONVERGENT
 * one, not strict -- "atomic" is a property of the SCENARIO you happened to test, not
 * of the routine (sub_30fa has four call paths, not all provably mask-cleared), so a
 * strict pass on one scenario would be a brittle false guarantee that could later
 * false-fail on a benign tear under a different one. The convergent gate still
 * catches everything that actually matters (a wrong cycle total, a wrong memory op, a
 * forked PRNG) as a PERSISTENT divergence.
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_30fa as translated_30fa } from "../../translated/state0.js";
import { sub_30fa as optimized_30fa } from "../sub_30fa.js";
import { Machine } from "../../machine.js";
import { unitEquivalence as coreUnitEquivalence } from "../../../../core/equivalence.js";
import { convergentGate, SCENARIOS } from "./convergent.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x30fa;
const FRAMES = 600;
const makeMachine = (overrides) => new Machine(ROM, overrides ? { overrides } : {});

// Corrupt the 0x6380 phase-index read so a DIFFERENT guard is dispatched -- a divergent
// animation outcome the state gate must catch.
function broken_30fa(m) {
  const realRead = m.mem.read8.bind(m.mem);
  let broke = false;
  m.mem.read8 = (addr, busOffset) => {
    if (!broke && addr === 0x6380) { broke = true; return realRead(addr, busOffset) ^ 0x05; } // XOR 5 -> always a different (still valid, <=5) guard index
    return realRead(addr, busOffset);
  };
  try { return optimized_30fa(m); } finally { m.mem.read8 = realRead; }
}

test("CONVERGENT (whole-machine): collapsed sub_30fa CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_30fa]]), { scenario: SCENARIOS.attract });

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

test("EQUAL (unit): collapsed sub_30fa matches translated in RAM + registers", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_30fa, optimized_30fa, { maxFrames: FRAMES + 100 });
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical");
});

test("TEETH (unit): a wrong dispatch index is CAUGHT and NOT-EQUAL", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_30fa, broken_30fa, { maxFrames: FRAMES + 100 });
  assert.equal(r.equal, false, "harness FAILED to catch a wrong dispatch");
  assert.ok(r.ram != null || r.regs != null || r.pc != null, "a caught divergence must be named");
  console.log(
    `  TEETH/unit: caught -- ${r.ram ? `RAM at 0x${r.ram.addr.toString(16)}` : r.regs ? `reg ${r.regs.reg}` : "pc"}`,
  );
});

// Cycle-broken twin for the CONVERGENT gate: identical memory + registers to the
// collapsed routine, but Block A's charge is 5 t short (20 -> 15). Block A runs on
// EVERY invocation (unconditional prologue), so the drop always fires. A wrong total
// forks the main loop's spin count (0x6019, the PRNG entropy) -- a PERSISTENT
// divergence, never a heal. This is the teeth for the collapse's load-bearing
// invariant (total-cycle preservation); a value-corruption twin would break a game
// invariant and could hang a long convergent run, so the value teeth stays at the
// fast unit level above (job "TEETH (unit)").
function cyclebroken_30fa(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6380);
  regs.cp(0x06);
  m.step(0x30ff, 15); // DROPPED: the correct charge here is 20 t
  if (regs.fC) {
    m.step(0x3103, 12);
  } else {
    regs.a = 0x05;
    m.step(0x3103, 14);
  }
  m.push16(0x3104);
  m.step(0x0028, 11);
  return m.call(0x0028, "0x3104 (sub_30fa dispatch, cycle-broken twin)");
}

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_30fa]]), { scenario: SCENARIOS.attract });

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
