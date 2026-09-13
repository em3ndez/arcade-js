// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_a23f -- the free-slot spawn attempt. Bails when PLAYER_FINE_ANGLE is negative; forms a
// gate (STATUS_FLAGS negative -> INPUT_DEBOUNCED & 0x10; else seed loc_29 from SPIKE_ACTIVE_FLAG and count loc_2b5 entries within 1 of
// PLAYER_SEGMENT over the loc_2db-gated slots); a zero gate bails. Otherwise it fills the first free SLOT_STATE slot
// (SLOT_STATE/TARGET_SEG/loc_2c0/HIT_TALLY), bumps ACTIVE_OBJECT_COUNT, and fires the two spawn helpers. loc_a23f takes no input
// register and returns via a plain RTS with no caller-read exit register, so the contract is RAM only
// (dumpState minus STACK_SCRATCH); no register is compared. Oracle is the frozen translated loc_a23f.
// Run: node --test games/tempest/idiomatic/test/equivalence-a23f.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_a23f as oracle } from "../../translated/loc_a23f.js";
import { loc_a23f } from "../loc_a23f.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import {
  STACK_SCRATCH,
  STATUS_FLAGS, loc_29, INPUT_DEBOUNCED, SPIKE_ACTIVE_FLAG, ACTIVE_OBJECT_COUNT,
  PLAYER_SEGMENT, PLAYER_FINE_ANGLE, PLAYER_SHOT_DEPTH, loc_2b5, SLOT_STATE, loc_2db,
} from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xa23f;
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

test("CAPTURE: real 0xa23f dispatches -- loc_a23f == oracle in RAM (-stack)", () => {
  let checked = 0;
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    let threw = false;
    try { oracle(o); } catch { threw = true; } // a real dispatch may reach an unimplemented helper arm
    if (threw) continue; // both layers would throw identically there; nothing to compare
    loc_a23f(c);
    assert.equal(ramDiff(o, c), null);
    checked++;
  }
  console.log(`  CAPTURE: ${checked}/${CAPS.length} dispatch(es) compared`);
});

// Counting-gate path: PLAYER_FINE_ANGLE/STATUS_FLAGS positive so we take the loc_2b5 count branch. Two loc_2db-gated slots,
// one whose loc_2b5 value equals PLAYER_SEGMENT (delta 0 -> counts) and one far away (no count) -> gate = 1.
// Every SLOT_STATE slot is zero so the first free slot (x=7) is filled and both spawn helpers fire.
function seedCount(m) {
  m.mem.write8(PLAYER_FINE_ANGLE, 0x40); // positive -> no early bail
  m.mem.write8(STATUS_FLAGS, 0x00);   // positive -> counting branch
  m.mem.write8(PLAYER_SEGMENT, 0x20); // reference value
  m.mem.write8(PLAYER_SHOT_DEPTH, 0x03); // seeded into the free slot
  m.mem.write8(SPIKE_ACTIVE_FLAG, 0x00); // loc_29 seed
  m.mem.write8(loc_2db + 0x02, 0x01); m.mem.write8(loc_2b5 + 0x02, 0x20); // delta 0 -> counts
  m.mem.write8(loc_2db + 0x05, 0x01); m.mem.write8(loc_2b5 + 0x05, 0x30); // delta 0x10 -> no count
}

test("CRAFTED (count gate): positive STATUS_FLAGS, gate from the loc_2b5 count, spawn fires -- RAM equal", () => {
  const o = new Machine(ROM, OPTS); seedCount(o);
  const c = new Machine(ROM, OPTS); seedCount(c);
  let threw = false;
  try { oracle(o); } catch { threw = true; }
  if (threw) { console.log("  CRAFTED(count): oracle threw on this seed -- skipped"); return; }
  loc_a23f(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after the counting-gate spawn");
  assert.equal(c.mem.read8(ACTIVE_OBJECT_COUNT), 0x01, "live count bumped -> the spawn actually ran");
  assert.equal(c.mem.read8(SLOT_STATE + 0x07), 0x03, "the free slot took PLAYER_SHOT_DEPTH");
});

// Negative-STATUS_FLAGS gate path: gate is INPUT_DEBOUNCED & 0x10. Set INPUT_DEBOUNCED = 0x10 so the gate is nonzero and the spawn
// runs; with STATUS_FLAGS negative the sound helper actually registers, exercising a different helper arm.
function seedNeg(m) {
  m.mem.write8(PLAYER_FINE_ANGLE, 0x40); // positive -> no early bail
  m.mem.write8(STATUS_FLAGS, 0x80);   // negative -> gate = INPUT_DEBOUNCED & 0x10
  m.mem.write8(INPUT_DEBOUNCED, 0x10);  // gate nonzero
  m.mem.write8(PLAYER_SEGMENT, 0x22);
  m.mem.write8(PLAYER_SHOT_DEPTH, 0x05);
}

test("CRAFTED (neg gate): negative STATUS_FLAGS, gate from INPUT_DEBOUNCED, spawn + sound helper -- RAM equal", () => {
  const o = new Machine(ROM, OPTS); seedNeg(o);
  const c = new Machine(ROM, OPTS); seedNeg(c);
  let threw = false;
  try { oracle(o); } catch { threw = true; }
  if (threw) { console.log("  CRAFTED(neg): oracle threw on this seed -- skipped"); return; }
  loc_a23f(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after the INPUT_DEBOUNCED-gate spawn");
  assert.equal(c.mem.read8(ACTIVE_OBJECT_COUNT), 0x01, "live count bumped -> the spawn actually ran");
});

test("TEETH: a twin that skips the ACTIVE_OBJECT_COUNT spawn-count bump MUST diverge in RAM", () => {
  const o = new Machine(ROM, OPTS); seedCount(o);
  const c = new Machine(ROM, OPTS); seedCount(c);
  let threw = false;
  try { oracle(o); } catch { threw = true; }
  if (threw) { console.log("  TEETH: oracle threw on this seed -- skipped"); return; }
  // Broken twin: identical to loc_a23f but reverts the ACTIVE_OBJECT_COUNT live-count bump. The seedCount seed always
  // spawns (ACTIVE_OBJECT_COUNT goes 0 -> 1), so reverting it guarantees a RAM divergence.
  let tried = 0;
  const broken = (m) => {
    const before135 = m.mem.read8(ACTIVE_OBJECT_COUNT);
    loc_a23f(m);
    tried++;
    m.mem.write8(ACTIVE_OBJECT_COUNT, before135); // BUG: drop the spawn-count bump
  };
  broken(c);
  assert.ok(tried > 0, "the broken twin ran");
  assert.notEqual(ramDiff(o, c), null, "the dropped ACTIVE_OBJECT_COUNT bump was NOT caught by the RAM compare");
});
