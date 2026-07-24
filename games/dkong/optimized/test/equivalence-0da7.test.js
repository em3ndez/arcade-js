// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_0da7 (the board-layout table walker: read each record from
 * the ROM table in DE, resolve its tilemap pointer, and dispatch loc_0dd3 to draw it,
 * until the 0xAA terminator). Called from loc_0cc6 during the 25m attract board draw
 * (~frame 518), so it dispatches in a plain boot run. COLLAPSED (one m.step per basic
 * block; see the docstring in ../sub_0da7.js for the per-path cycle totals).
 *
 * The whole-machine gate is the CONVERGENT gate, unconditionally: "atomic" is a property
 * of the scenario tested, not of the routine, so a strict pass here would be a brittle
 * guarantee that could later false-fail on a benign tear. Everything that actually matters
 * (a wrong cycle total, a wrong memory op, a forked PRNG) is a PERSISTENT divergence that
 * the convergent gate also catches; only the benign-tear false alarm is given up.
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_0da7 as translated_0da7 } from "../../translated/nmi.js";
import { sub_0da7 as optimized_0da7 } from "../sub_0da7.js";
import { Machine } from "../../machine.js";
import { unitEquivalence as coreUnitEquivalence } from "../../../../core/equivalence.js";
import { convergentGate, SCENARIOS } from "./convergent.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x0da7;
const FRAMES = 600;
const makeMachine = (overrides) => new Machine(ROM, overrides ? { overrides } : {});

// Break sub_0da7's first sub-tile phase store 0x63AF. loc_0dd3 reads it as the endpoint
// tile base, so a wrong value stamps a wrong board tile into video RAM. Safe to use over
// the SHORT unit-level run (a single captured entry), unlike a long convergent run.
function broken_0da7(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (addr, value, busOffset) => {
    if (!broke && addr === 0x63af) { broke = true; return realWrite(addr, value ^ 0xff, busOffset); }
    return realWrite(addr, value, busOffset);
  };
  try { return optimized_0da7(m); } finally { m.mem.write8 = realWrite; }
}

// Cycle-broken twin for the CONVERGENT gate: identical memory + registers to the collapsed
// routine, but the very first m.step charge (the kind-read+test block, 27 t) is shaved by
// 5 t. A wrong cycle total shifts the main loop's spin count (0x6019, the PRNG entropy) --
// a PERSISTENT non-stack divergence, never a heal -- so this is the teeth for the collapse's
// load-bearing invariant (total-cycle preservation). Never a value-corruption twin here: that
// breaks a game invariant and can hang a long convergent run.
function cyclebroken_0da7(m) {
  const realStep = m.step.bind(m);
  let broke = false;
  m.step = (pc, cyc) => {
    if (!broke) { broke = true; return realStep(pc, cyc - 5); }
    return realStep(pc, cyc);
  };
  try {
    return optimized_0da7(m);
  } finally {
    m.step = realStep;
  }
}

// -- EQUAL (whole-machine, convergent) -----------------------------------------

test("CONVERGENT (whole-machine): collapsed sub_0da7 CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_0da7]]), { scenario: SCENARIOS.attract });

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

test("EQUAL (unit): collapsed sub_0da7 matches translated in RAM + registers", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_0da7, optimized_0da7, { maxFrames: FRAMES + 100 });
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical");
});

// -- TEETH ----------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_0da7]]), { scenario: SCENARIOS.attract });

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

test("TEETH (unit): a wrong tile-phase store is CAUGHT", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_0da7, broken_0da7, { maxFrames: FRAMES + 100 });
  assert.equal(r.equal, false, "harness FAILED to catch a wrong store");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  console.log(`  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} (translated ${r.ram.a} vs broken ${r.ram.b})`);
});
