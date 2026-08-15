// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampHomeBayFrogByColumn — memory-equivalent to the frozen oracle at ROM 0x06A2.
 * GATE: crafted-entry. Attract never dispatches this board-complete home-reveal dispatcher (probe: 0 dispatches
 * over ENTRY_FRAMES; it fires only when a frog reaches home), so a post-boot attract machine is cloned
 * and its home-column selector poked. Every dispatch arm is swept: the five per-slot stamp selectors,
 * the fill-all-plus-award selector, and a no-match selector that must return without writing. Attract
 * leaves the slot blocks pre-stamped, so the entry clears them to make each stamp an observable VRAM
 * write and pokes a below-cap life count so the award tail stamps its marker. The fill-all arm runs
 * the still-frozen stamp routine and award tail for real on each side, so their writes are part of the
 * compared live-out. Memory-only live-out (RAM compared, not registers/SP); the dissolved fill-all
 * call means the oracle leaves dead [SP-8,SP) stack scratch the rewrite does not, so that window is
 * masked. Teeth: no-op, wrong-tile, wrong-slot, skip-award-tail, write-on-no-match.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { fillAllHomeSlotsAndAwardLife } from "../fillAllHomeSlotsAndAwardLife.js";
import { stampHomeBayFrogByColumn } from "../stampHomeBayFrogByColumn.js";
import { loc_06a2 as oracle } from "../../translated/loc_06a2.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ACTIVE_PLAYER = 0x83fd;
const LIFE_COUNT_P1 = 0x83b8;
const HOME_COLUMN_STATE = 0x842f; // fill-all clears this
const SLOT_BASES = [0xab64, 0xaaa4, 0xa9e4, 0xa924, 0xa864];
const FROG_TILES = [252, 253, 254, 255]; // frog-in-home 2x2 graphic tiles
const FILL_TILE = 16; // fill-all stamps this into all four cells of every slot
const STAMP_ARMS = [[192, 0xab64], [144, 0xaaa4], [112, 0xa9e4], [80, 0xa924], [48, 0xa864]];
const FILL_ALL = 16;
const NO_MATCH = 0;
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

// A post-boot machine set to a given home-column selector, all slot blocks cleared (so each stamp is
// observable), player one active with a below-cap life count (so the fill-all award stamps a marker).
function craft(selector) {
  const e = seedMachine().clone();
  e.regs.a = selector;
  e.mem8[ACTIVE_PLAYER] = 1;
  e.mem8[LIFE_COUNT_P1] = 3;
  for (const b of SLOT_BASES) for (const off of [0, 1, 32, 33]) e.mem8[(b + off) & 0xffff] = 0;
  return e;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP. Neutralize the dead
// [SP-8,SP) stack scratch the oracle's fill-all push/call leaves and the register-free rewrite does not.
function ramDiff(cand, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  for (let k = 1; k <= 8; k++) { const w = (sp - k) & 0xffff; a.mem8[w] = 0; b.mem8[w] = 0; }
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// broken twins.
function brokenNoOp() {}
function brokenWrongTile(m) { // right slot, wrong frog tiles (all zero)
  const { mem8 } = m;
  const b = 0xab64;
  mem8[b] = 0; mem8[b + 1] = 0; mem8[b + 32] = 0; mem8[b + 33] = 0;
}
function brokenWrongSlot(m) { // stamps slot 2 when selector 192 asks for slot 1
  const { mem8 } = m;
  const b = 0xaaa4;
  mem8[b] = FROG_TILES[0]; mem8[b + 1] = FROG_TILES[1]; mem8[b + 32] = FROG_TILES[2]; mem8[b + 33] = FROG_TILES[3];
}
function brokenSkipAwardTail(m) { // fills all five slots but drops the award hand-off
  const { mem8 } = m;
  for (const b of SLOT_BASES) { mem8[b] = FILL_TILE; mem8[b + 1] = FILL_TILE; mem8[(b + 32) & 0xffff] = FILL_TILE; mem8[(b + 33) & 0xffff] = FILL_TILE; }
  mem8[HOME_COLUMN_STATE] = 0;
  // BUG: omit the award tail (no life bump, no life marker)
}
function brokenWriteOnNoMatch(m) { // stamps slot 1 for a selector that should write nothing
  const { mem8 } = m;
  const b = 0xab64;
  mem8[b] = FROG_TILES[0]; mem8[b + 1] = FROG_TILES[1]; mem8[b + 32] = FROG_TILES[2]; mem8[b + 33] = FROG_TILES[3];
}

test("EQUAL (crafted): stampHomeBayFrogByColumn == oracle on every dispatch arm", { skip }, () => {
  for (const [sel, base] of STAMP_ARMS) {
    const e = craft(sel);
    assert.equal(ramDiff(stampHomeBayFrogByColumn, e), null, `stamp selector 0x${sel.toString(16)} diverged`);
    assert.ok(ramDiff(brokenNoOp, e), `vacuous: oracle wrote nothing for selector 0x${sel.toString(16)}`);
    const chk = e.clone(); oracle(chk);
    assert.equal(chk.mem8[base], FROG_TILES[0], `oracle did not stamp slot base 0x${base.toString(16)}`);
  }

  const fa = craft(FILL_ALL);
  assert.equal(ramDiff(stampHomeBayFrogByColumn, fa), null, "fill-all selector diverged");
  const fchk = fa.clone(); oracle(fchk);
  assert.equal(fchk.mem8[0xab64], FILL_TILE, "fill-all did not stamp slot 1");
  assert.equal(fchk.mem8[0xa864], FILL_TILE, "fill-all did not stamp slot 5");
  assert.equal(fchk.mem8[LIFE_COUNT_P1], 4, "fill-all award did not bump the life count");

  const nm = craft(NO_MATCH);
  assert.equal(ramDiff(stampHomeBayFrogByColumn, nm), null, "no-match selector diverged");
  assert.equal(ramDiff(brokenNoOp, nm), null, "no-match arm unexpectedly wrote memory");

  console.log("  EQUAL: five stamp arms, fill-all + award, no-match, stampHomeBayFrogByColumn == oracle");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const stamp = craft(192);
  assert.ok(ramDiff(brokenNoOp, stamp), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongTile, stamp), "the wrong-tile twin escaped");
  assert.ok(ramDiff(brokenWrongSlot, stamp), "the wrong-slot twin escaped");

  const fa = craft(FILL_ALL);
  assert.ok(ramDiff(brokenNoOp, fa), "the no-op twin escaped on fill-all");
  assert.ok(ramDiff(brokenSkipAwardTail, fa), "the skip-award-tail twin escaped");

  const nm = craft(NO_MATCH);
  assert.ok(ramDiff(brokenWriteOnNoMatch, nm), "the write-on-no-match twin escaped");

  console.log("  TEETH: no-op, wrong-tile, wrong-slot, skip-award-tail, write-on-no-match all caught");
});
