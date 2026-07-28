// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for entry_2913 (proximity/collision query over IX object records, with
 * the sub_0008 skip-return convention). Dispatches many times in a plain attract run (8
 * wrapper callers). COLLAPSED (one m.step per basic block; see entry_2913.js's CYCLES note).
 *
 * WHOLE-MACHINE gate: CONVERGENT, not strict. entry_2913 happened to read back byte-exact
 * under the strict gate for the plain-attract scenario tested here, but atomicity is a
 * property of the SCENARIO, not the routine -- a strict pass here is not a guarantee it
 * stays byte-exact under every input tape (e.g. active gameplay), so it is licensed the same
 * way as every other collapsed routine (docs/decompiler-pipeline; see sub_0350): pixels are the ground truth,
 * transient state/pixel divergence is fine if it reconverges, the dead stack is excluded, and
 * a PERSISTENT divergence still fails. Its whole-machine teeth is a CYCLE-DROP twin, not a
 * value-corruption one: being READ-ONLY (it writes no work RAM), a corrupted active-flag read
 * here only forces one record through the FULL distance check instead of an early skip -- with
 * no hit at stake in a plain attract run, the extra reads are pure overhead that changes
 * nothing observable except cycle count, so it cannot be told apart from a benign timing wobble
 * at the unit level. A wrong CYCLE TOTAL, in contrast, is a bug this routine's collapse can
 * actually make (see entry_2913.js's CYCLES note) and is what the teeth below proves is caught
 * (also matching the "no value-corruption twin over a long run" rule -- see sub_0350).
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { entry_2913 as translated_2913 } from "../../translated/state0.js";
import { entry_2913 as optimized_2913 } from "../entry_2913.js";
import { Machine } from "../../machine.js";
import { unitEquivalence as coreUnitEquivalence } from "../../../../core/equivalence.js";
import { convergentGate, SCENARIOS } from "./convergent.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2913;
const FRAMES = 600;
const makeMachine = (overrides) => new Machine(ROM, overrides ? { overrides } : {});

// Cycle-broken twin for the CONVERGENT gate: identical logic to the collapsed routine, but
// the "slot inactive" block's charge is 5 t short (30 -> 25). Wrong totals shift the main
// loop's spin count (0x6019 PRNG entropy) -- a PERSISTENT divergence, never a heal.
function cyclebroken_2913(m) {
  const { regs, mem } = m;
  m.push16(regs.ix);
  m.step(0x2915, 15);
  for (;;) {
    advance: {
      const ea2915 = (regs.ix + 0x00) & 0xffff;
      regs.bit(0, mem.read8(ea2915), (ea2915 >> 8) & 0xff);
      if (regs.fZ) {
        m.step(0x294c, 25); // DROPPED: the correct charge here is 30 t
        break advance;
      }
      m.step(0x291c, 30);
      regs.a = regs.c;
      regs.sub(mem.read8((regs.ix + 0x05) & 0xffff));
      if (regs.fNC) { m.step(0x2925, 33); } else { m.step(0x2923, 33); regs.neg(); m.step(0x2925, 8); }
      regs.a = regs.inc8(regs.a);
      regs.sub(regs.l);
      if (regs.fC) {
        m.step(0x2930, 18);
      } else {
        m.step(0x292a, 18);
        regs.sub(mem.read8((regs.ix + 0x0a) & 0xffff));
        if (regs.fNC) { m.step(0x294c, 29); break advance; }
        m.step(0x2930, 29);
      }
      regs.a = mem.read8((regs.iy + 0x03) & 0xffff);
      regs.sub(mem.read8((regs.ix + 0x03) & 0xffff));
      if (regs.fNC) { m.step(0x293b, 48); } else { m.step(0x2939, 48); regs.neg(); m.step(0x293b, 8); }
      regs.sub(regs.h);
      if (regs.fC) {
        m.step(0x2945, 14);
      } else {
        m.step(0x293f, 14);
        regs.sub(mem.read8((regs.ix + 0x09) & 0xffff));
        if (regs.fNC) { m.step(0x294c, 29); break advance; }
        m.step(0x2945, 29);
      }
      regs.a = 0x01;
      regs.ix = m.pop16();
      regs.sp = (regs.sp + 1) & 0xffff;
      regs.sp = (regs.sp + 1) & 0xffff;
      m.step(0x294b, 33);
      m.ret();
      return false;
    }
    regs.addIx(regs.de);
    regs.djnz();
    m.step(regs.b !== 0 ? 0x2915 : 0x2950, regs.b !== 0 ? 28 : 23);
    if (regs.b === 0) break;
  }
  regs.xor(regs.a);
  regs.ix = m.pop16();
  m.step(0x2953, 18);
  m.ret();
  return true;
}

test("CONVERGENT (whole-machine): collapsed entry_2913 CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_2913]]), { scenario: SCENARIOS.attract });

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

test("EQUAL (unit): idiomatic optimized entry_2913 matches translated in RAM + registers", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_2913, optimized_2913, { maxFrames: FRAMES + 100 });
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical");
});

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_2913]]), { scenario: SCENARIOS.attract });

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

