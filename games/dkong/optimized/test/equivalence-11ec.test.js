// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_11ec (interleaved strided copy: B passes, 2 bytes to E and E+2,
 * E+1 skipped). Reached from sub_11a6 during the 25m attract board build (~frame 518),
 * first with DE=0x6683. COLLAPSED to one m.step per loop iteration (see optimized/sub_11ec.js);
 * atomicity is not pinned to the mask-cleared NMI, so the whole-machine job runs under the
 * CONVERGENT gate (pixels + persistent non-stack state), per the lead's unconditional rule:
 * any routine with a whole-machine test gets the convergent gate, not the strict one.
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_11ec as translated_11ec } from "../../translated/state0.js";
import { sub_11ec as optimized_11ec } from "../sub_11ec.js";
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

const TARGET = 0x11ec;
const FRAMES = 600;
const makeMachine = (overrides) => new Machine(ROM, overrides ? { overrides } : {});

// Corrupt the first destination byte sub_11ec writes (its first `ld (de),a`, addr in the
// shadow-table range). The tables feed rendering, so a wrong copy is a caught divergence.
function brokenFirstDest(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (addr, value, busOffset) => {
    if (!broke && addr >= 0x6400 && addr < 0x6a80) { broke = true; return realWrite(addr, value ^ 0xff, busOffset); }
    return realWrite(addr, value, busOffset);
  };
  try { return optimized_11ec(m); } finally { m.mem.write8 = realWrite; }
}

/**
 * Cycle-broken twin for the CONVERGENT gate: identical memory + registers to the
 * collapsed routine, but the per-iteration total is 5 t short, so a wrong total forks
 * the main loop's spin count (0x6019 PRNG entropy) -- a PERSISTENT divergence, never a
 * heal. This is the teeth for the collapse's load-bearing invariant (total-cycle
 * preservation).
 */
function cyclebroken_11ec(m) {
  const { regs, mem } = m;
  do {
    regs.a = mem.read8(regs.hl);
    mem.write8(regs.de, regs.a);
    regs.hl = (regs.hl + 1) & 0xffff;
    regs.e = regs.inc8(regs.e);
    regs.e = regs.inc8(regs.e);
    regs.a = mem.read8(regs.hl);
    mem.write8(regs.de, regs.a);
    regs.hl = (regs.hl + 1) & 0xffff;
    regs.a = regs.e;
    regs.add(regs.c);
    regs.e = regs.a;
    regs.djnz();
    m.step(regs.b !== 0 ? 0x11ec : 0x11f9, 55 + (regs.b !== 0 ? 13 : 8)); // DROPPED: correct body is 60 t
  } while (regs.b !== 0);
  m.ret();
}

test("CONVERGENT (whole-machine): collapsed sub_11ec CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_11ec]]), { scenario: SCENARIOS.attract });
  assert.ok(r.invocations.get(TARGET) >= 1, `override never dispatched (invocations=${r.invocations.get(TARGET)})`);
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

test("EQUAL (unit): collapsed sub_11ec matches translated in RAM + registers", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_11ec, optimized_11ec, { maxFrames: FRAMES + 100 });
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical");
});

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_11ec]]), { scenario: SCENARIOS.attract });
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

test("TEETH (unit): a wrong interleaved copy is CAUGHT", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_11ec, brokenFirstDest, { maxFrames: FRAMES + 100 });
  assert.equal(r.equal, false, "harness FAILED to catch a wrong store");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  console.log(`  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} (translated ${r.ram.a} vs broken ${r.ram.b})`);
});
