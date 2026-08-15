// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b83 — memory-equivalent to the frozen oracle at ROM 0x2B83.
 * GATE: crafted-entry. Attract never dispatches this sprite-object dispatcher (probe: 0 dispatches
 * over ENTRY_FRAMES), so a post-boot attract machine is cloned and IX/IY are pointed at a sprite-object
 * record and its sprite slot. An ACTIVE entry (object flag set, spawn gated off by a low count)
 * exercises the steer / write-X / hit-test / write-attr arms; a SPAWN entry (object clear, count past
 * the spawn gate) exercises the spawn arm's PRNG draws. Each side runs the real still-frozen arms on
 * its own clone, so their writes are part of the compared live-out. Memory-only live-out (RAM compared,
 * not registers/SP); the dissolved calls mask the oracle's dead [SP-8,SP) stack scratch. Teeth: no-op,
 * drop-write-attr, drop-spawn.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_2b83 } from "../loc_2b83.js";
import { loc_2b83 as oracle } from "../../translated/loc_2b83.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { spawnSpriteObject } from "../spawnSpriteObject.js";
import { steerSpriteObjectTowardTarget } from "../steerSpriteObjectTowardTarget.js";
import { writeSpriteObjectSlotX } from "../writeSpriteObjectSlotX.js";
import { flagSpriteObjectFrogHitAhead } from "../flagSpriteObjectFrogHitAhead.js";
import { writeSpriteObjectSlotAttr } from "../writeSpriteObjectSlotAttr.js";

const OBJECT_RECORD = 0x8480; // one of the two IX sprite-object records the caller selects
const SPRITE_SLOT = 0x8058;   // the IY sprite slot the arms stage into
const LEVEL_COUNT = 0x83b7;   // spawn arm gate: below 3 skips the spawn draw
const HOLD = 0x8004;
const ACTIVE = 6;             // record+6: object active flag / state
const MOVE_TIMER = 9;         // record+9: steer move timer
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let seed = null;
function seedMachine() {
  if (seed) return seed;
  const m = makeMachine();
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the seed run stopped early: ${m.stoppedBy}`);
  seed = m.clone();
  return seed;
}

// An active object with the spawn arm gated off, so the steer / write-X / hit-test / write-attr arms
// all act on it and stage the sprite slot.
function craftActive() {
  const e = seedMachine().clone();
  e.regs.ix = OBJECT_RECORD; e.regs.iy = SPRITE_SLOT;
  e.mem8[LEVEL_COUNT] = 0;                              // below the spawn gate
  e.mem8[(OBJECT_RECORD + ACTIVE) & 0xffff] = 1;
  e.mem8[(OBJECT_RECORD + MOVE_TIMER) & 0xffff] = 1;   // fires the steer step this pass
  e.mem8[(OBJECT_RECORD + 0x0b) & 0xffff] = 4;
  e.mem8[(OBJECT_RECORD + 0) & 0xffff] = 0x40;
  e.mem8[(OBJECT_RECORD + 1) & 0xffff] = 0x40;
  e.mem8[(OBJECT_RECORD + 2) & 0xffff] = 0x40;
  e.mem8[(OBJECT_RECORD + 4) & 0xffff] = 0x30;
  e.mem8[(OBJECT_RECORD + 5) & 0xffff] = 0;
  e.mem8[(SPRITE_SLOT + 0) & 0xffff] = 0x50;
  e.mem8[HOLD] = 0;
  return e;
}

// An inactive object past the spawn gate, so the spawn arm runs its PRNG draws.
function craftSpawn() {
  const e = seedMachine().clone();
  e.regs.ix = OBJECT_RECORD; e.regs.iy = SPRITE_SLOT;
  e.mem8[LEVEL_COUNT] = 5;
  e.mem8[(OBJECT_RECORD + ACTIVE) & 0xffff] = 0;
  return e;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP. Neutralize the dead
// [SP-8,SP) stack scratch the oracle's per-arm push/call leaves and the register-free rewrite does not.
function ramDiff(cand, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  for (let k = 1; k <= 8; k++) { const w = (sp - k) & 0xffff; a.mem8[w] = 0; b.mem8[w] = 0; }
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

function brokenNoOp() {}
function brokenDropWriteAttr(m) {
  spawnSpriteObject(m);
  steerSpriteObjectTowardTarget(m);
  writeSpriteObjectSlotX(m);
  flagSpriteObjectFrogHitAhead(m);
  // BUG: omit the write-attr arm
}
function brokenDropSpawn(m) {
  // BUG: omit the spawn arm
  steerSpriteObjectTowardTarget(m);
  writeSpriteObjectSlotX(m);
  flagSpriteObjectFrogHitAhead(m);
  writeSpriteObjectSlotAttr(m);
}

test("EQUAL (crafted): loc_2b83 == oracle on the active-object entry", { skip }, () => {
  const e = craftActive();
  assert.equal(ramDiff(loc_2b83, e), null, "the active entry diverged");
  assert.ok(ramDiff(brokenNoOp, e), "vacuous: oracle wrote nothing on the active entry");
  console.log("  EQUAL: active object, loc_2b83 == oracle");
});

test("EQUAL (crafted): loc_2b83 == oracle on the spawn entry", { skip }, () => {
  const e = craftSpawn();
  assert.equal(ramDiff(loc_2b83, e), null, "the spawn entry diverged");
  assert.ok(ramDiff(brokenNoOp, e), "vacuous: oracle wrote nothing on the spawn entry");
  console.log("  EQUAL: spawn arm, loc_2b83 == oracle");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const active = craftActive();
  const spawn = craftSpawn();
  assert.ok(ramDiff(brokenNoOp, active), "the no-op twin escaped");
  assert.ok(ramDiff(brokenDropWriteAttr, active), "the drop-write-attr twin escaped");
  assert.ok(ramDiff(brokenDropSpawn, spawn), "the drop-spawn twin escaped");
  console.log("  TEETH: no-op, drop-write-attr, drop-spawn all caught");
});
