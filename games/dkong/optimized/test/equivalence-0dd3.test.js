// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_0dd3 (decode one board-layout record: read its length and
 * phase, resolve the tilemap pointer via sub_2ff0, stamp the endpoint tiles, then fall
 * into loc_0e19). The main draw primitive of sub_0da7, exercised during the 25m attract
 * board draw (~frame 518), so it dispatches in a plain boot run.
 *
 * COLLAPSED (one m.step per basic block); the whole-machine gate is the CONVERGENT one,
 * not strict, because "atomic" is a property of the SCENARIO you happened to test, not
 * of the routine -- sub_0da7's callers (loc_17b6/loc_1880) are not analytically pinned
 * to the mask-cleared NMI, so a strict pass on one scenario would be a brittle false
 * guarantee that could later false-fail on a benign tear under a different one. The
 * convergent gate still catches everything that actually matters (a wrong cycle total,
 * a wrong memory op, a forked PRNG) as a PERSISTENT divergence.
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0dd3 as translated_0dd3 } from "../../translated/nmi.js";
import { loc_0dd3 as optimized_0dd3 } from "../loc_0dd3.js";
import { Machine } from "../../machine.js";
import { unitEquivalence as coreUnitEquivalence } from "../../../../core/equivalence.js";
import { convergentGate, SCENARIOS } from "./convergent.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x0dd3;
const FRAMES = 600;
const makeMachine = (overrides) => new Machine(ROM, overrides ? { overrides } : {});

// Break loc_0dd3's run-length store 0x63B2 (0x0DDD). The per-record 0x63xx scratch is
// rewritten by later records so it heals, but 0x63B2 feeds the cell COUNT the vertical
// drawer loc_0e19 (or loc_0e4f) walks, so a wrong value misdraws board tiles into video
// RAM — a PERSISTENT divergence the gate catches.
function broken_0dd3(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (addr, value, busOffset) => {
    if (!broke && addr === 0x63b2) { broke = true; return realWrite(addr, value ^ 0xff, busOffset); }
    return realWrite(addr, value, busOffset);
  };
  try { return optimized_0dd3(m); } finally { m.mem.write8 = realWrite; }
}

// Cycle-broken twin for the CONVERGENT gate: identical memory + registers to the
// collapsed routine, but the first block's charge is 5 t short (85 -> 80). A wrong
// total forks the main loop's spin count (0x6019, the PRNG entropy) -- a PERSISTENT
// divergence, never a heal. This is the teeth for the collapse's load-bearing
// invariant (total-cycle preservation); a value-corruption twin would break a game
// invariant and hang a long whole-machine run, so the value teeth stays at the unit
// level below.
function cyclebroken_0dd3(m) {
  const { regs, mem } = m;
  mem.write8(0x63b1, regs.a);
  regs.de = (regs.de + 1) & 0xffff;
  regs.a = mem.read8(regs.de);
  regs.l = regs.a;
  regs.sub(regs.c);
  mem.write8(0x63b2, regs.a);
  regs.a = mem.read8(regs.de);
  regs.and(0x07);
  mem.write8(0x63b0, regs.a);
  m.push16(regs.de);
  m.step(0x0de4, 80); // DROPPED: the correct charge here is 85 t

  m.push16(0x0de7);
  m.step(0x2ff0, 17);
  m.call(0x2ff0);

  regs.de = m.pop16();
  mem.write16(0x63ad, regs.hl);
  regs.a = mem.read8(0x63b3);
  regs.cp(0x02);
  m.step(0x0df0, 46);
  if (regs.fP) { m.step(0x0e4f, 10); return m.call(0x0e4f); }

  regs.a = mem.read8(0x63b2);
  regs.sub(0x10);
  regs.b = regs.a;
  regs.a = mem.read8(0x63af);
  regs.add(regs.b);
  mem.write8(0x63b2, regs.a);
  regs.a = mem.read8(0x63af);
  regs.add(0xf0);
  regs.hl = mem.read16(0x63ab);
  mem.write8(regs.hl, regs.a);
  regs.l = regs.inc8(regs.l);
  regs.sub(0x30);
  mem.write8(regs.hl, regs.a);
  regs.a = mem.read8(0x63b3);
  regs.cp(0x01);
  m.step(0x0e12, 145);

  if (regs.fNZ) {
    m.step(0x0e19, 10);
  } else {
    regs.xor(regs.a);
    mem.write8(0x63b2, regs.a);
    m.step(0x0e19, 27);
  }
  m.call(0x0e19);
}

test("CONVERGENT (whole-machine): collapsed loc_0dd3 CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_0dd3]]), { scenario: SCENARIOS.attract });

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

test("EQUAL (unit): idiomatic optimized loc_0dd3 matches translated in RAM + registers", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_0dd3, optimized_0dd3, { maxFrames: FRAMES + 100 });
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical");
});

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_0dd3]]), { scenario: SCENARIOS.attract });

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

test("TEETH (unit): a wrong store is CAUGHT", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_0dd3, broken_0dd3, { maxFrames: FRAMES + 100 });
  assert.equal(r.equal, false, "harness FAILED to catch a wrong store");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  console.log(`  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} (translated ${r.ram.a} vs broken ${r.ram.b})`);
});
