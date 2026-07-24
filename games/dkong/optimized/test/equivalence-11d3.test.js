// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_11d3 (permuting gather: B passes, reading IX+3/+7/+8/+5 into
 * four consecutive dest bytes, then add ix,de). Reached from sub_11a6 during the 25m
 * attract board build (~frame 518), first with HL=0x6A18.
 *
 * COLLAPSED (one m.step per loop iteration) and ATOMIC: every call site is inside the
 * board-setup family (loc_101f, loc_1087, loc_1131, sub_1186, sub_11a6), reached only via
 * sub_0f56/loc_0d5f, dispatched by dispatchGameState INSIDE the vblank NMI with the mask
 * cleared -- the NMI cannot land mid-routine. Per the lead's rule, the whole-machine gate
 * is the CONVERGENT one regardless (a passing strict gate is scenario-brittle, not proof);
 * its teeth is a CYCLE-DROP twin, not a value-corruption twin, so a long convergent run
 * cannot hang on a persisting corrupted store.
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_11d3 as translated_11d3 } from "../../translated/state0.js";
import { sub_11d3 as optimized_11d3 } from "../sub_11d3.js";
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

const TARGET = 0x11d3;
const FRAMES = 600;
const makeMachine = (overrides) => new Machine(ROM, overrides ? { overrides } : {});

// Corrupt the first destination byte sub_11d3 writes (its first `ld (hl),a`, addr in the
// sprite-buffer/shadow range). Used only at the UNIT level (single-shot, no interruption
// concern) -- a long convergent run with a persisting value corruption can hang the game.
function brokenFirstDest(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (addr, value, busOffset) => {
    if (!broke && addr >= 0x6400 && addr < 0x6a80) { broke = true; return realWrite(addr, value ^ 0xff, busOffset); }
    return realWrite(addr, value, busOffset);
  };
  try { return optimized_11d3(m); } finally { m.mem.write8 = realWrite; }
}

/**
 * CYCLE-DROP twin for the CONVERGENT gate: identical memory/registers to the collapsed
 * routine, but the per-iteration charge is 5 t short. A wrong total forks the main loop's
 * spin count (0x6019 PRNG entropy) -- a PERSISTENT divergence, never a heal.
 */
function cyclebroken_11d3(m) {
  const { regs, mem } = m;
  do {
    for (const disp of [0x03, 0x07, 0x08, 0x05]) {
      regs.a = mem.read8((regs.ix + disp) & 0xffff);
      mem.write8(regs.hl, regs.a);
      regs.l = regs.inc8(regs.l);
    }
    regs.addIx(regs.de);
    regs.djnz();
    m.step(regs.b !== 0 ? 0x11d3 : 0x11eb, regs.b !== 0 ? 143 : 138); // DROPPED: 5 t short
  } while (regs.b !== 0);
  m.ret();
}

test("CONVERGENT (whole-machine): collapsed sub_11d3 CONVERGES vs translated", () => {
  const r = convergentGate(new Map([[TARGET, optimized_11d3]]), { scenario: SCENARIOS.attract });

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

test("EQUAL (unit): per-instruction-order-preserved sub_11d3 matches translated in RAM + registers", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_11d3, optimized_11d3, { maxFrames: FRAMES + 100 });
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical");
});

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_11d3]]), { scenario: SCENARIOS.attract });

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

test("TEETH (unit): a wrong gather is CAUGHT", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_11d3, brokenFirstDest, { maxFrames: FRAMES + 100 });
  assert.equal(r.equal, false, "harness FAILED to catch a wrong store");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  console.log(`  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} (translated ${r.ram.a} vs broken ${r.ram.b})`);
});
