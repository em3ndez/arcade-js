// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_0e19 (draw a vertical run of 0xC0 cells, stepping the span
 * counter 0x63B2 down by 8 until it underflows, then tail into loc_0e2a). A draw
 * primitive of the board-layout renderer sub_0da7, which draws the 25m board during
 * the attract demo (~frame 518) — so it dispatches in a plain boot run, no coin needed.
 *
 * COLLAPSED (one m.step per basic block). Per the lead's rule the whole-machine gate is
 * the CONVERGENT one regardless of whether strict still passes — a passing strict test
 * is a property of the SCENARIO tested, not proof of atomicity, since sub_0da7's call
 * graph includes callers (loc_17b6/loc_1880) not independently confirmed here to run
 * only inside the mask-cleared NMI. The convergent gate's teeth is a CYCLE-DROP twin
 * (never a value-corruption twin over a long run, which can hang the game).
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0e19 as translated_0e19 } from "../../translated/nmi.js";
import { loc_0e19 as optimized_0e19 } from "../loc_0e19.js";
import { Machine } from "../../machine.js";
import { convergentGate, SCENARIOS } from "./convergent.js";
import {
  unitEquivalence as coreUnitEquivalence,
} from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x0e19;
const FRAMES = 600; // 25m board draws in attract at ~frame 518

const makeMachine = (overrides) => new Machine(ROM, overrides ? { overrides } : {});

// Break loc_0e19's own first VRAM output (a 0xC0 cell) — a static board tile that
// persists to the frame boundary. UNIT level only (single-shot; a long convergent run
// with a persisting value corruption can hang the game).
function broken_0e19(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (addr, value, busOffset) => {
    if (!broke && value === 0xc0) { broke = true; return realWrite(addr, value ^ 0xff, busOffset); }
    return realWrite(addr, value, busOffset);
  };
  try { return optimized_0e19(m); } finally { m.mem.write8 = realWrite; }
}

/**
 * CYCLE-DROP twin for the CONVERGENT gate: identical memory/registers to the collapsed
 * routine, but the draw-block charge is 5 t short. A wrong total forks the main loop's
 * spin count (0x6019 PRNG entropy) -- a PERSISTENT divergence, never a heal.
 */
function cyclebroken_0e19(m) {
  const { regs, mem } = m;
  for (;;) {
    regs.a = mem.read8(0x63b2);
    regs.sub(0x08);
    mem.write8(0x63b2, regs.a);
    if (regs.fC) { m.step(0x0e2a, 43); break; }
    m.step(0x0e24, 43);
    regs.l = regs.inc8(regs.l);
    mem.write8(regs.hl, 0xc0);
    m.step(0x0e19, 19); // DROPPED: the correct charge here is 24 t
  }
  return m.call(0x0e2a);
}

test("CONVERGENT (whole-machine): collapsed loc_0e19 CONVERGES vs translated", () => {
  const r = convergentGate(new Map([[TARGET, optimized_0e19]]), { scenario: SCENARIOS.attract });

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

test("EQUAL (unit): collapsed loc_0e19 matches translated in RAM + registers", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_0e19, optimized_0e19, { maxFrames: FRAMES + 100 });
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical");
});

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_0e19]]), { scenario: SCENARIOS.attract });

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

test("TEETH (unit): a wrong 0xC0 cell store is CAUGHT", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_0e19, broken_0e19, { maxFrames: FRAMES + 100 });
  assert.equal(r.equal, false, "harness FAILED to catch a wrong store");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  console.log(`  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} (translated ${r.ram.a} vs broken ${r.ram.b})`);
});
