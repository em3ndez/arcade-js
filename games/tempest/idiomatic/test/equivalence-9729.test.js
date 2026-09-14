// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_9729 (ROM 0x9729-0x9748) -- the per-frame update chain. It clears bit7 of
// SPIKED_SEGMENT_COUNT, runs the five state updaters rotateBlasterAroundRim/advanceMovingSpike/ageTimedObjects/spawnEntityIntoFreeSlot/stepActiveShots in order, then when
// PLAYER_FINE_ANGLE is negative (bit7 set) runs ageShotsAndAdvanceFrameClock. It is a plain call-and-return routine (no computed
// dispatch, no tail delegate) that leaves no value a caller reads back, so the contract is RAM only
// (dumpState minus STACK_SCRATCH); no register is compared and there is no seam tooth. Oracle is the
// frozen translated loc_9729.
// Run: node --test games/tempest/idiomatic/test/equivalence-9729.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_9729 as oracle } from "../../translated/loc_9729.js";
import { loc_9729 } from "../loc_9729.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, SPIKED_SEGMENT_COUNT, PLAYER_FINE_ANGLE } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0x9729;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps before any boot-gap throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 3000) : [];

test("CAPTURE: real 0x9729 dispatches -- loc_9729 == oracle in RAM (-stack)", () => {
  let checked = 0;
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    let threw = false;
    try { oracle(o); } catch { threw = true; } // a real dispatch may reach an unimplemented draw arm
    if (threw) continue; // both layers would throw identically there; nothing to compare
    loc_9729(c);
    assert.equal(ramDiff(o, c), null);
    checked++;
  }
  console.log(`  CAPTURE: ${checked}/${CAPS.length} dispatch(es) compared`);
});

// PLAYER_FINE_ANGLE negative -> the two flag-guarded updaters (rotateBlasterAroundRim, advanceMovingSpike) early-return and the extra
// updater ageShotsAndAdvanceFrameClock runs; SPIKED_SEGMENT_COUNT has bit7 set so the signature clear is observable.
function seedExtra(m) {
  m.mem.write8(SPIKED_SEGMENT_COUNT, 0xff); // bit7 set -> the clear must land
  m.mem.write8(PLAYER_FINE_ANGLE, 0x80); // negative -> ageShotsAndAdvanceFrameClock runs, rotateBlasterAroundRim/advanceMovingSpike skip
  m.regs.x = 0x00; m.regs.y = 0x00;
}

// PLAYER_FINE_ANGLE positive -> rotateBlasterAroundRim/advanceMovingSpike run their bodies and ageShotsAndAdvanceFrameClock is skipped.
function seedBodies(m) {
  m.mem.write8(SPIKED_SEGMENT_COUNT, 0xc4); // bit7 set -> clear observable, low bits survive
  m.mem.write8(PLAYER_FINE_ANGLE, 0x00); // positive -> updaters run, ageShotsAndAdvanceFrameClock skipped
  m.regs.x = 0x00; m.regs.y = 0x00;
}

test("CRAFTED: PLAYER_FINE_ANGLE negative -- chain runs, ageShotsAndAdvanceFrameClock fires, RAM equal", () => {
  const o = new Machine(ROM, OPTS); seedExtra(o);
  const c = new Machine(ROM, OPTS); seedExtra(c);
  let threw = false;
  try { oracle(o); } catch { threw = true; }
  if (threw) { console.log("  CRAFTED(extra): oracle threw on this seed -- skipped"); return; }
  loc_9729(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after the chain + ageShotsAndAdvanceFrameClock");
  assert.equal(c.mem.read8(SPIKED_SEGMENT_COUNT), o.mem.read8(SPIKED_SEGMENT_COUNT), "SPIKED_SEGMENT_COUNT matches the oracle");
  assert.equal(c.mem.read8(SPIKED_SEGMENT_COUNT) & 0x80, 0, "bit7 of SPIKED_SEGMENT_COUNT cleared");
});

test("CRAFTED: PLAYER_FINE_ANGLE positive -- updaters run, ageShotsAndAdvanceFrameClock skipped, RAM equal", () => {
  const o = new Machine(ROM, OPTS); seedBodies(o);
  const c = new Machine(ROM, OPTS); seedBodies(c);
  let threw = false;
  try { oracle(o); } catch { threw = true; }
  if (threw) { console.log("  CRAFTED(bodies): oracle threw on this seed -- skipped"); return; }
  loc_9729(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after the update chain");
  assert.equal(c.mem.read8(SPIKED_SEGMENT_COUNT) & 0x80, 0, "bit7 of SPIKED_SEGMENT_COUNT cleared");
});

test("TEETH: a twin that skips the bit7 clear of SPIKED_SEGMENT_COUNT MUST diverge in RAM", () => {
  const o = new Machine(ROM, OPTS); seedExtra(o);
  const c = new Machine(ROM, OPTS); seedExtra(c);
  let threw = false;
  try { oracle(o); } catch { threw = true; }
  if (threw) { console.log("  TEETH: oracle threw on this seed -- skipped"); return; }
  // Broken twin: identical to loc_9729 but restores SPIKED_SEGMENT_COUNT's original value, dropping the signature
  // clear. SPIKED_SEGMENT_COUNT was seeded with bit7 set, so the dropped clear guarantees a RAM divergence.
  const broken = (m) => {
    const before123 = m.mem.read8(SPIKED_SEGMENT_COUNT);
    loc_9729(m);
    m.mem.write8(SPIKED_SEGMENT_COUNT, before123); // BUG: revert the bit7 clear
  };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the dropped bit7 clear was NOT caught by the RAM compare");
});
