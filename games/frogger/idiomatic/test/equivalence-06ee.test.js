// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_06ee — memory-equivalent to the frozen oracle at ROM 0x06EE.
 * GATE: crafted-entry. Attract never dispatches this page swap-in (probe: 0 over ENTRY_FRAMES), so a
 * coherent post-boot state captured at the per-frame score redraw (0x0b1f) is cloned and its active-
 * player cell poked to drive both arms: player 1 runs the four bank copies here, any other value
 * tails to the frozen swap-OUT (0x0726), which both sides reach via m.call and run on a fresh clone.
 * The bank regions are seeded with distinct markers so every copy is observable. The routine reads
 * no register live-in and its live-out is memory-only, so RAM is compared and registers/SP are not.
 * Teeth: four broken twins (no-op, wrong flag, dropped copy, wrong branch).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_06ee } from "../loc_06ee.js";
import { loc_06ee as oracle } from "../../translated/loc_06ee.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const NEIGHBOUR = 0x0b1f;
const PLAYER_CELL = 0x83fd;
const SWAP_DONE = 0x803f;
const OBJECT_BYTES = 43;
const PAGE_BYTES = 183;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let seed = null;
function seedState() {
  if (seed) return seed;
  const real = TRANSLATED.get(NEIGHBOUR);
  const m = makeMachine(new Map([[NEIGHBOUR, (mm) => {
    if (!seed) seed = mm.clone();
    return real(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  assert.ok(seed, "vacuous: the neighbour was never dispatched, no state to replay");
  return seed;
}

// A coherent state with the active player poked and the six bank regions marked so copies show.
function craft(player) {
  const c = seedState().clone();
  c.mem8[PLAYER_CELL] = player;
  for (let i = 0; i < OBJECT_BYTES; i++) {
    c.mem8[0x800c + i] = (0x10 + i) & 0xff;
    c.mem8[0x86c0 + i] = (0x40 + i) & 0xff;
    c.mem8[0x85c0 + i] = (0x70 + i) & 0xff;
  }
  for (let i = 0; i < PAGE_BYTES; i++) {
    c.mem8[0x80ff + i] = (0x20 + i) & 0xff;
    c.mem8[0x8600 + i] = (0x50 + i) & 0xff;
    c.mem8[0x8500 + i] = (0x90 + i) & 0xff;
  }
  c.mem8[SWAP_DONE] = 0;
  return c;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

function copy(mem8, dst, src, n) { for (let i = 0; i < n; i++) mem8[dst + i] = mem8[src + i]; }

// broken twins the RAM diff must catch.
function brokenNoOp() {}
function brokenWrongFlag(m) {
  const { mem8 } = m;
  if (mem8[0x83fd] !== 1) return m.call(0x0726);
  copy(mem8, 0x85c0, 0x800c, 43); copy(mem8, 0x8600, 0x80ff, 183);
  copy(mem8, 0x800c, 0x86c0, 43); mem8[0x803f] = 2; // BUG: wrong flag value
  copy(mem8, 0x80ff, 0x8500, 183);
}
function brokenDropCopy(m) {
  const { mem8 } = m;
  if (mem8[0x83fd] !== 1) return m.call(0x0726);
  copy(mem8, 0x85c0, 0x800c, 43); copy(mem8, 0x8600, 0x80ff, 183);
  copy(mem8, 0x800c, 0x86c0, 43); mem8[0x803f] = 1;
  // BUG: drops the final page restore
}
function brokenWrongBranch(m) {
  const { mem8 } = m; // BUG: always swaps IN, never tails to swap-OUT
  copy(mem8, 0x85c0, 0x800c, 43); copy(mem8, 0x8600, 0x80ff, 183);
  copy(mem8, 0x800c, 0x86c0, 43); mem8[0x803f] = 1;
  copy(mem8, 0x80ff, 0x8500, 183);
}

test("EQUAL (crafted): loc_06ee == oracle on both player arms", { skip }, () => {
  for (const p of [1, 2]) assert.equal(ramDiff(loc_06ee, craft(p)), null, `player ${p} diverged`);
  assert.ok(ramDiff(brokenNoOp, craft(1)), "vacuous: oracle wrote nothing on player 1");
  assert.ok(ramDiff(brokenNoOp, craft(2)), "vacuous: oracle wrote nothing on player 2");
  console.log("  EQUAL: player-1 swap-in and player-2 swap-out arms, loc_06ee == oracle");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const p1 = craft(1), p2 = craft(2);
  assert.ok(ramDiff(brokenNoOp, p1), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongFlag, p1), "the wrong-flag twin escaped");
  assert.ok(ramDiff(brokenDropCopy, p1), "the dropped-copy twin escaped");
  assert.ok(ramDiff(brokenWrongBranch, p2), "the wrong-branch twin escaped");
  console.log("  TEETH: no-op, wrong-flag, dropped-copy, wrong-branch all caught");
});
