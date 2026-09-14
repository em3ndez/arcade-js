// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for commitPendingModeAfterDelay -- while the guard flag ($03 & $016b) is clear, runs down the delay
// counter $04; when it lands on zero it arms the next state ($00 = $02) and clears the guard $016b. Every
// path tail-delegates jmp 0x9749 (dissolved into the idiomatic rotateBlasterAroundRim, Y threaded). Live-out is memory
// only, so each arm compares RAM (dumpState minus STACK_SCRATCH). The routine seats state then tail-calls,
// so it is an omitted-ret dispatch (SP-tooth). $0201 bit7 is seeded to steer the delegated update to its
// deterministic early-out.
// Run: node --test games/tempest/idiomatic/test/equivalence-c800.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_c800 as oracle } from "../../translated/loc_c800.js";
import { commitPendingModeAfterDelay } from "../commitPendingModeAfterDelay.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, PLAYER_FINE_ANGLE, FRAME_COUNTER, MODE_DELAY_GUARD, MODE_DELAY_TIMER, GAME_MODE, GAME_MODE_PENDING } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) { const u = new URL(name, ROM_DIR); return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined; }
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xc800;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps before any boot-gap throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 4000) : [];

test("CAPTURE: real 0xc800 dispatches -- commitPendingModeAfterDelay == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); commitPendingModeAfterDelay(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

test("CRAFTED: guard clear + counter reaches zero -- arm next state, clear guard", () => {
  const seed = (m) => {
    m.mem.write8(PLAYER_FINE_ANGLE, 0x80);   // steer the delegated update to its early-out
    m.mem.write8(FRAME_COUNTER, 0x00);     // guard clear
    m.mem.write8(MODE_DELAY_GUARD, 0x01);
    m.mem.write8(MODE_DELAY_TIMER, 0x01);     // -> decrements to 0 -> arm
    m.mem.write8(GAME_MODE_PENDING, 0x37);
    m.mem.write8(GAME_MODE, 0x00);
  };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); commitPendingModeAfterDelay(c);
  assert.equal(ramDiff(o, c), null, "RAM equal on the arm path");
  assert.equal(c.mem.read8(GAME_MODE), 0x37, "$00 armed from $02");
  assert.equal(c.mem.read8(MODE_DELAY_GUARD), 0x00, "guard cleared");
  assert.equal(c.mem.read8(MODE_DELAY_TIMER), 0x00, "counter landed on zero");
});

test("CRAFTED: guard set -- tail-delegate with no arm", () => {
  const seed = (m) => {
    m.mem.write8(PLAYER_FINE_ANGLE, 0x80);
    m.mem.write8(FRAME_COUNTER, 0xff);     // guard bits present
    m.mem.write8(MODE_DELAY_GUARD, 0x01);
    m.mem.write8(MODE_DELAY_TIMER, 0x05);
    m.mem.write8(GAME_MODE_PENDING, 0x37);
    m.mem.write8(GAME_MODE, 0x00);
  };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); commitPendingModeAfterDelay(c);
  assert.equal(ramDiff(o, c), null, "RAM equal on the guarded path");
  assert.equal(c.mem.read8(GAME_MODE), 0x00, "$00 not armed");
  assert.equal(c.mem.read8(MODE_DELAY_TIMER), 0x05, "counter untouched");
});

test("CRAFTED: guard clear + counter still counting -- decrement only, no arm", () => {
  const seed = (m) => {
    m.mem.write8(PLAYER_FINE_ANGLE, 0x80);
    m.mem.write8(FRAME_COUNTER, 0x00);
    m.mem.write8(MODE_DELAY_GUARD, 0x01);
    m.mem.write8(MODE_DELAY_TIMER, 0x05);     // -> 4, no arm
    m.mem.write8(GAME_MODE_PENDING, 0x37);
    m.mem.write8(GAME_MODE, 0x00);
  };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o); commitPendingModeAfterDelay(c);
  assert.equal(ramDiff(o, c), null, "RAM equal on the counting path");
  assert.equal(c.mem.read8(MODE_DELAY_TIMER), 0x04, "counter decremented");
  assert.equal(c.mem.read8(GAME_MODE), 0x00, "no arm while counting");
});

test("TEETH: a twin that arms regardless of the guard diverges from the oracle", () => {
  const seed = (m) => {
    m.mem.write8(PLAYER_FINE_ANGLE, 0x80);
    m.mem.write8(FRAME_COUNTER, 0xff);     // guard set -> oracle must NOT arm
    m.mem.write8(MODE_DELAY_GUARD, 0x01);
    m.mem.write8(MODE_DELAY_TIMER, 0x01);
    m.mem.write8(GAME_MODE_PENDING, 0x37);
    m.mem.write8(GAME_MODE, 0x00);
  };
  const o = new Machine(ROM, OPTS); seed(o);
  const c = new Machine(ROM, OPTS); seed(c);
  oracle(o);
  // BUG: ignores the guard and always arms when the counter runs down.
  const broken = (m) => {
    const { mem8 } = m;
    let count = mem8[MODE_DELAY_TIMER];
    if (count !== 0) { count = (count - 1) & 0xff; mem8[MODE_DELAY_TIMER] = count; }
    if (count === 0) { mem8[GAME_MODE] = mem8[GAME_MODE_PENDING]; mem8[MODE_DELAY_GUARD] = 0x00; }
  };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the ignored guard");
});

test("SP-TOOTH: the omitted-ret dispatch (moved 0) is seam-placeable", () => {
  const m = new Machine(ROM, OPTS);
  m.mem.write8(PLAYER_FINE_ANGLE, 0x80);
  m.mem.write8(FRAME_COUNTER, 0xff);
  m.regs.s = 0xfb;
  m.mem.write8(0x01fc, 0x34); m.mem.write8(0x01fd, 0x12);
  const r = seamPlaceable(withOmittedRet, commitPendingModeAfterDelay, TARGET, m);
  assert.equal(r.placeable, true, `commitPendingModeAfterDelay must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: omitted-ret dispatch (moved 0) placeable");
});
