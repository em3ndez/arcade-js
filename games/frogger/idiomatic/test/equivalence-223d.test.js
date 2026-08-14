// SPDX-License-Identifier: GPL-3.0-only
/**
 * loadActivePlayerLaneParams — memory-equivalent to the frozen oracle at ROM 0x223D.
 * GATE: crafted-entry. Attract never dispatches this per-difficulty block loader (probe: 0 dispatches
 * over ENTRY_FRAMES; every caller is a game-start/board-init path attract does not enter), so a
 * post-boot attract machine is cloned and the active-player number (0x83FD) plus the P1/P2 difficulty
 * indices (0x8293/0x8294) are poked to drive both player branches and several table entries. The
 * 33-byte destination (0x8270) is pre-cleared so the copy is observable. LIVE-OUT is memory-only: the
 * routine runs under EXX (caller BC/DE/HL preserved) and every caller reloads A, so registers are not
 * compared; it pushes nothing, so no stack window is excluded. Teeth: three broken twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loadActivePlayerLaneParams } from "../loadActivePlayerLaneParams.js";
import { loc_223d as oracle } from "../../translated/loc_223d.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const PLAYER = 0x83fd;
const P1_INDEX = 0x8293, P2_INDEX = 0x8294;
const DEST = 0x8270;
const BLOCK_SIZE = 33;
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

// A post-boot machine with a poked player + difficulty indices and a cleared destination block.
function craft(player, p1idx, p2idx) {
  const e = seedMachine().clone();
  e.mem8[PLAYER] = player;
  e.mem8[P1_INDEX] = p1idx;
  e.mem8[P2_INDEX] = p2idx;
  for (let i = 0; i < BLOCK_SIZE; i++) e.mem8[(DEST + i) & 0xffff] = 0;
  return e;
}

// null == RAM-equivalent (memory-only live-out, no stack scratch to exclude).
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// [name, player, p1idx, p2idx]
const CASES = [
  ["P1 index 0", 1, 0, 0],
  ["P1 index 1", 1, 1, 0],
  ["P1 index 4 (last table entry)", 1, 4, 0],
  ["P2 index 0", 2, 0, 0],
  ["P2 index 3", 2, 0, 3],
  ["player not 1 -> P2 branch", 7, 9, 2],
];

// broken twins.
function brokenNoOp() {}
function brokenWrongPlayer(m) { // always reads the P1 index, ignoring the player number
  const { mem8, mem16 } = m;
  const block = mem16[(0x2260 + 2 * mem8[P1_INDEX]) & 0xffff];
  for (let i = 0; i < BLOCK_SIZE; i++) mem8[(DEST + i) & 0xffff] = mem8[(block + i) & 0xffff];
}
function brokenShortCopy(m) { // copies 32 bytes, one short
  const { mem8, mem16 } = m;
  const idx = mem8[PLAYER] === 1 ? P1_INDEX : P2_INDEX;
  const block = mem16[(0x2260 + 2 * mem8[idx]) & 0xffff];
  for (let i = 0; i < BLOCK_SIZE - 1; i++) mem8[(DEST + i) & 0xffff] = mem8[(block + i) & 0xffff];
}

test("EQUAL (crafted): loadActivePlayerLaneParams == oracle on both player branches and several table entries", { skip }, () => {
  assert.ok(CASES.length > 0, "vacuous: no crafted entries");
  for (const [name, ...args] of CASES) {
    assert.equal(ramDiff(loadActivePlayerLaneParams, craft(...args)), null, `diverged: ${name}`);
  }
  assert.ok(ramDiff(brokenNoOp, craft(1, 1, 0)), "vacuous: oracle wrote nothing");
  console.log(`  EQUAL: ${CASES.length} crafted player/index paths, loadActivePlayerLaneParams == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const eP2 = craft(2, 0, 3); // P2 branch: a wrong-player twin picks the wrong index
  const eP1 = craft(1, 4, 0);
  assert.ok(ramDiff(brokenNoOp, eP2), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongPlayer, eP2), "the wrong-player twin escaped");
  assert.ok(ramDiff(brokenShortCopy, eP1), "the short-copy twin escaped");
  console.log("  TEETH: no-op, wrong-player, short-copy all caught");
});
