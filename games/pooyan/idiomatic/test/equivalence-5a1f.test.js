// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence test for loc_5a1f (ROM 0x5a1f, Pooyan) — per-frame score-drip step, variant B.
 *
 * SEATING: BALANCED — no register inputs; a void step (no caller reads a register back), so LIVE-OUT
 * is memory only and the comparison is RAM (dumpState) minus STACK_SCRATCH. SP parked in STACK_SCRATCH.
 * Not a dispatcher, no register bridge — the accumulate amount is handed to the shared tail (loc_5a8c)
 * as an explicit JS param, not through a CPU register.
 *
 * Crafted paths: off-phase (ring low3 != fire) -> only the ring advances; fire with the first coord
 * not overtaking the second -> counter bump + coord advance, then early return; fire + overtake with a
 * partial wrap (low nibble != 0x0f) -> loc_5a8c; fire + overtake with a full wrap -> loc_5a8a.
 *
 * Jobs:
 *   1. EQUAL — every crafted path: oracle == module in RAM (−stack).
 *   2. WRITE-SET — off-phase advances only the ring; a fire bumps the counter and the first coord.
 *   3. TEETH — a corrupted post-run byte is caught; a twin that skips the step diverges.
 *
 * Run: node --test games/pooyan/idiomatic/test/equivalence-5a1f.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_5a1f as oracle } from "../../translated/loc_5a1f.js";
import { loc_5a1f } from "../loc_5a1f.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/pooyan rom'" }, fn);

const SP0 = 0x8ff0;
const INPUT_PORT0 = 0x8810;
const DRIP_RING_B = 0x882d;
const COIN2_PULSE_COUNT = 0x8826;
const DRIP_COORD_B = 0x882e;
const COORD2 = 0x882f; // second coord of the pair (shares COINAGE_CONFIG_SLOT2)

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const inDeadStack = (addr) => addr != null && addr >= STACK_SCRATCH.lo && addr < STACK_SCRATCH.hi;
const BASE = ROM_PRESENT ? new Machine(ROM).clone() : null;

function ramDiffMinusStack(ma, mb) {
  return firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);
}

function seat(m, { ring = 0, input = 0, counter = 0, coord = 0, coord2 = 0 } = {}) {
  m.regs.sp = SP0;
  m.regs.i = 0x00;
  m.regs.iff2 = false;
  m.mem.write8(DRIP_RING_B, ring);
  m.mem.write8(INPUT_PORT0, input);
  m.mem.write8(COIN2_PULSE_COUNT, counter);
  m.mem.write8(DRIP_COORD_B, coord);
  m.mem.write8(COORD2, coord2);
  return m;
}

const CASES = {
  // ring 0x02 << 1 = 0x04 -> low3 != 1 -> off phase
  "off phase": (m) => seat(m, { ring: 0x02, input: 0x00 }),
  // input bit1 -> carry 1 -> ring 1 -> fire; coord1 0x10 <= coord2 0x20 -> early return
  "fire, no overtake": (m) => seat(m, { ring: 0x00, input: 0x02, coord: 0x00, coord2: 0x20 }),
  // fire; coord1 0x40 > coord2 0x20, low nibble 0x0 -> partial wrap (loc_5a8c)
  "fire, partial wrap": (m) => seat(m, { ring: 0x00, input: 0x02, coord: 0x30, coord2: 0x20 }),
  // fire; coord1 0x40 > coord2 0x2f, low nibble 0xf -> full wrap (loc_5a8a)
  "fire, full wrap": (m) => seat(m, { ring: 0x00, input: 0x02, coord: 0x30, coord2: 0x2f }),
};

// -- 1. EQUAL -----------------------------------------------------------------

test("EQUAL: loc_5a1f == oracle in RAM (−stack)", () => {
  for (const [name, craft] of Object.entries(CASES)) {
    const o = craft(BASE.clone());
    const c = craft(BASE.clone());
    oracle(o);
    loc_5a1f(c);
    const d = ramDiffMinusStack(o, c);
    assert.equal(d, null, d && `${name}: RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} module=${d.b}`);
  }
  console.log(`  EQUAL: ${Object.keys(CASES).length} paths identical (RAM −stack)`);
});

// -- 2. WRITE-SET -------------------------------------------------------------

test("WRITE-SET: off-phase advances only the ring; a fire bumps the counter and first coord", () => {
  const off = CASES["off phase"](BASE.clone());
  loc_5a1f(off);
  assert.equal(off.mem.read8(DRIP_RING_B), 0x04, "ring 0x02 << 1 -> 0x04");
  assert.equal(off.mem.read8(COIN2_PULSE_COUNT), 0x00, "off phase must not bump the counter");

  const fire = CASES["fire, no overtake"](BASE.clone());
  loc_5a1f(fire);
  assert.equal(fire.mem.read8(COIN2_PULSE_COUNT), 0x01, "a fire bumps the counter");
  assert.equal(fire.mem.read8(DRIP_COORD_B), 0x10, "coord 0x00 + 0x10 -> 0x10");
  console.log("  WRITE-SET: off-phase ring only; fire bumps counter + coord");
});

// -- 3. TEETH -----------------------------------------------------------------

test("TEETH: a corrupted post-run byte is CAUGHT by the RAM diff", () => {
  const o = CASES["fire, no overtake"](BASE.clone());
  const c = CASES["fire, no overtake"](BASE.clone());
  oracle(o);
  loc_5a1f(c);
  c.mem.write8(COIN2_PULSE_COUNT, (o.mem.read8(COIN2_PULSE_COUNT) ^ 0xff) & 0xff);
  const d = ramDiffMinusStack(o, c);
  assert.notEqual(d, null, "the gate FAILED to catch a corrupted byte");
  assert.equal(d.addr, COIN2_PULSE_COUNT, `teeth caught wrong address ${hx(d.addr ?? 0)}`);
  console.log(`  TEETH(RAM): caught at ${hx(d.addr)}`);
});

test("TEETH: a twin that skips the step diverges from the oracle", () => {
  const o = CASES["fire, partial wrap"](BASE.clone());
  const c = CASES["fire, partial wrap"](BASE.clone()); // twin: never run the step
  oracle(o);
  const d = ramDiffMinusStack(o, c);
  assert.notEqual(d, null, "a skipped drip step must be caught by the RAM diff");
  console.log(`  TEETH(skip): caught at ${hx(d.addr ?? 0)}`);
});
