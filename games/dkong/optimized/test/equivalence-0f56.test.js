// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_0f56 (per-board work-RAM setup: zero 0x6200-0x6AFF, copy the
 * board-layout ROM data, compute the bonus timer, seed sprites, then dispatch via the
 * inline rst 0x28 table to the board's own setup). Called from loc_0d5f during the 25m
 * attract board build (~frame 518), dispatching to board 1 (loc_0fd7). COLLAPSED (one
 * m.step per basic-block pass); atomicity is not pinned to the mask-cleared NMI, so the
 * whole-machine gate is CONVERGENT (see optimized/sub_0f56.js).
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_0f56 as translated_0f56 } from "../../translated/state0.js";
import { sub_0f56 as optimized_0f56 } from "../sub_0f56.js";
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

const TARGET = 0x0f56;
const FRAMES = 600;
const makeMachine = (overrides) => new Machine(ROM, overrides ? { overrides } : {});

// Corrupt sub_0f56's first store to `addr`. Two targets, because the routine dispatches
// into the board's own setup (loc_0fd7) before it returns:
//   - 0x62B0 (bonus timer): re-derived by end of the setup frame, but the corrupted
//     BACKUP surfaces a frame later through the timer countdown -- a PERSISTENT full-game
//     divergence the whole-machine gate catches at frame 519.
//   - 0x6200 (a cleared game-state byte): loc_0fd7 relies on the zero-fill and never
//     rewrites it, so it survives to the routine boundary where the unit gate compares.
function brokenAt(addr) {
  return (m) => {
    const realWrite = m.mem.write8.bind(m.mem);
    let broke = false;
    m.mem.write8 = (a, value, busOffset) => {
      if (!broke && a === addr) { broke = true; return realWrite(a, value ^ 0xff, busOffset); }
      return realWrite(a, value, busOffset);
    };
    try { return optimized_0f56(m); } finally { m.mem.write8 = realWrite; }
  };
}

test("CONVERGENT (whole-machine): collapsed sub_0f56 CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  // sub_0f56 is COLLAPSED and its atomicity is not pinned to the mask-cleared NMI, so
  // the strict byte-exact gate is the wrong tool -- see optimized/sub_0f56.js.
  const r = convergentGate(new Map([[TARGET, optimized_0f56]]), { scenario: SCENARIOS.attract });
  assert.ok(r.invocations.get(TARGET) >= 1, `override never dispatched (invocations=${r.invocations.get(TARGET)})`);
  assert.equal(
    r.pass,
    true,
    r.pass ? "" : `NOT convergent: persistent state ${JSON.stringify(r.statePersistent)}, pixelPersistent=${r.pixelPersistent}`,
  );
  console.log(
    `  CONVERGENT: pass, fired ${r.invocations.get(TARGET)}x (25m board build -> board 1); ` +
      `${r.pixDiffFrames} tear frame(s) (max ${r.maxPixels}px, healed), non-stack state persistent = ${r.statePersistent.length}`,
  );
});

test("EQUAL (unit): collapsed sub_0f56 matches translated in RAM + registers", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_0f56, optimized_0f56, { maxFrames: FRAMES + 100 });
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical");
});

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  // Cycle-drop twin (wraps m.step to shave 5 t off ONE specific folded charge, matching
  // the sub_0141 wrong-total idiom), not value-corruption -- a value twin can hang a long
  // convergent run instead of diverging cleanly. Targets the clear-A prologue's folded
  // charge (pc 0x0f5c, the unique 21 t call -- the loop body reuses 0x0f5c with 24/19 t,
  // so matching on the exact (pc, cyc) pair hits only the prologue).
  function cyclebroken_0f56(m) {
    const realStep = m.step.bind(m);
    let dropped = false;
    m.step = (pc, cyc) => {
      if (!dropped && pc === 0x0f5c && cyc === 21) {
        dropped = true;
        return realStep(pc, cyc - 5); // correct total is 21 t, short by 5
      }
      return realStep(pc, cyc);
    };
    try {
      return optimized_0f56(m);
    } finally {
      m.step = realStep;
    }
  }
  const r = convergentGate(new Map([[TARGET, cyclebroken_0f56]]), { scenario: SCENARIOS.attract });
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

test("TEETH (unit): a wrong game-state clear is CAUGHT and names 0x6200", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_0f56, brokenAt(0x6200), { maxFrames: FRAMES + 100 });
  assert.equal(r.equal, false, "harness FAILED to catch a wrong store");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  assert.equal(r.ram.addr, 0x6200, `expected first diff at 0x6200, got 0x${r.ram.addr.toString(16)}`);
  console.log(`  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} (translated ${r.ram.a} vs broken ${r.ram.b})`);
});
