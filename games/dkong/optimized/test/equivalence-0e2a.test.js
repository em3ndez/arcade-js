// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_0e2a (finish a layout record — stamp its endpoint tiles,
 * then tail-jump to sub_0da7 for the next record). A draw primitive of the board-layout
 * renderer sub_0da7, exercised during the 25m attract board draw (~frame 518), so it
 * dispatches in a plain boot run. COLLAPSED (one m.step per basic block); atomicity is
 * not provable across sub_0da7's callers, so the whole-machine gate is CONVERGENT (see
 * optimized/loc_0e2a.js).
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0e2a as translated_0e2a } from "../../translated/nmi.js";
import { loc_0e2a as optimized_0e2a } from "../loc_0e2a.js";
import { Machine } from "../../machine.js";
import {
  unitEquivalence as coreUnitEquivalence,
} from "../../../../core/equivalence.js";
import { convergentGate, SCENARIOS } from "./convergent.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x0e2a;
const FRAMES = 600;
const makeMachine = (overrides) => new Machine(ROM, overrides ? { overrides } : {});

// Break loc_0e2a's first tile store (the record's base tile at 0x0E33) — a static
// board cell that persists to the frame boundary.
function broken_0e2a(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (addr, value, busOffset) => {
    if (!broke) { broke = true; return realWrite(addr, value ^ 0xff, busOffset); }
    return realWrite(addr, value, busOffset);
  };
  try { return optimized_0e2a(m); } finally { m.mem.write8 = realWrite; }
}

test("CONVERGENT (whole-machine): collapsed loc_0e2a CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  // loc_0e2a is COLLAPSED and its atomicity is not provable across sub_0da7's callers,
  // so the strict byte-exact gate is the wrong tool -- see optimized/loc_0e2a.js.
  const r = convergentGate(new Map([[TARGET, optimized_0e2a]]), { scenario: SCENARIOS.attract });
  assert.ok(r.invocations.get(TARGET) >= 1, `override never dispatched (invocations=${r.invocations.get(TARGET)})`);
  assert.equal(
    r.pass,
    true,
    r.pass ? "" : `NOT convergent: persistent state ${JSON.stringify(r.statePersistent)}, pixelPersistent=${r.pixelPersistent}`,
  );
  console.log(
    `  CONVERGENT: pass, fired ${r.invocations.get(TARGET)}x; ${r.pixDiffFrames} tear frame(s) ` +
      `(max ${r.maxPixels}px, healed), non-stack state persistent = ${r.statePersistent.length}`,
  );
});

test("EQUAL (unit): collapsed loc_0e2a matches translated in RAM + registers", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_0e2a, optimized_0e2a, { maxFrames: FRAMES + 100 });
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical");
});

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  // Cycle-drop twin, not value-corruption (a value twin can hang a long convergent run
  // instead of diverging cleanly; the unit TEETH below covers value corruption).
  function cyclebroken_0e2a(m) {
    const { regs, mem } = m;
    regs.a = mem.read8(0x63b0);
    regs.add(0xd0);
    regs.hl = mem.read16(0x63ad);
    mem.write8(regs.hl, regs.a);
    m.step(0x0e33, 38); // DROPPED: correct total is 43 t, short by 5
    regs.a = mem.read8(0x63b3);
    regs.cp(0x01);
    m.step(0x0e38, 20);
    if (regs.fNZ) { m.step(0x0e3f, 10); } else {
      regs.l = regs.dec8(regs.l); mem.write8(regs.hl, 0xc0); regs.l = regs.inc8(regs.l);
      m.step(0x0e3f, 28);
    }
    regs.a = mem.read8(0x63b0);
    regs.cp(0x00);
    m.step(0x0e44, 20);
    if (regs.fZ) { m.step(0x0e4b, 10); } else {
      regs.add(0xe0); regs.l = regs.inc8(regs.l); mem.write8(regs.hl, regs.a);
      m.step(0x0e4b, 28);
    }
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x0da7, 16);
  }
  const r = convergentGate(new Map([[TARGET, cyclebroken_0e2a]]), { scenario: SCENARIOS.attract });
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.pass, false, "convergent gate FAILED to catch a wrong cycle total -- it is worthless");
  assert.ok(
    r.statePersistent.length > 0 || r.pixelPersistent,
    "a caught divergence must be persistent (non-stack state or pixels)",
  );
  console.log(
    `  TEETH/convergent: caught -- persistent non-stack addrs ${r.statePersistent.length}, ` +
      `pixelPersistent ${r.pixelPersistent}`,
  );
});

test("TEETH (unit): a wrong tile store is CAUGHT", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_0e2a, broken_0e2a, { maxFrames: FRAMES + 100 });
  assert.equal(r.equal, false, "harness FAILED to catch a wrong store");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  console.log(`  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} (translated ${r.ram.a} vs broken ${r.ram.b})`);
});
