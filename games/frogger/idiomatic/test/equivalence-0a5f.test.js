// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardExtraLife — memory-equivalent to the frozen oracle at ROM 0x0A5F.
 * GATE: crafted-entry. Attract never dispatches this extra-life award (probe: 0 dispatches over
 * ENTRY_FRAMES), so a post-boot attract machine is cloned and its player-number (0x83FD) and the
 * player's life counter poked to drive each path — player 1, player 2, and the 0x10 cap that skips
 * the marker. The lives-row column is pre-cleared so the marker stamp is observable. The routine is
 * reached only through a caller chain that reloads A and pops every register, so its live-out is
 * memory-only; registers/SP are not compared. Teeth: three broken RAM twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { awardExtraLife } from "../awardExtraLife.js";
import { loc_0a5f as oracle } from "../../translated/loc_0a5f.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const PLAYER_CELL = 0x83fd;
const P1_LIVES = 0x83b8;
const P2_LIVES = 0x83b9;
const MIRROR = 0x83b7;
const CLEARED = 0x83cc;
const ROW_BASE = 0xa85e;
const ROW_STRIDE = 32;
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

// A post-boot machine with a chosen active player and seeded life count, lives-row column cleared so
// the marker stamp is observable (a valid entry: this leaf reads player/count out of its own RAM).
function entry(player, livesCell, val) {
  const e = seedMachine().clone();
  e.mem8[PLAYER_CELL] = player;
  e.mem8[livesCell] = val;
  let p = ROW_BASE;
  for (let i = 0; i < 16; i++) { e.mem8[p] = 0; p = (p + ROW_STRIDE) & 0xffff; }
  return e;
}

// null == RAM-equivalent. Memory-only live-out.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

const CASES = [
  ["player 1 -> 4", 1, P1_LIVES, 3],
  ["player 2 -> 7", 2, P2_LIVES, 6],
  ["capped -> 0x10", 1, P1_LIVES, 0x0f],
  ["player 1 -> 1", 1, P1_LIVES, 0],
];

function bumpTo(m) {
  const cell = m.mem8[PLAYER_CELL] === 1 ? P1_LIVES : P2_LIVES;
  return (m.mem8[cell] + 1) & 0xff;
}
// broken twins.
function brokenNoOp() {}
function brokenWrongCount(m) {
  const { mem8 } = m;
  mem8[CLEARED] = 0;
  const cell = mem8[PLAYER_CELL] === 1 ? P1_LIVES : P2_LIVES;
  const c = (mem8[cell] + 2) & 0xff; // BUG: bumps by two
  mem8[cell] = c; mem8[MIRROR] = c;
  if (c >= 16) return;
  mem8[(ROW_BASE + c * ROW_STRIDE) & 0xffff] = 76;
}
function brokenNoMarker(m) {
  const { mem8 } = m;
  mem8[CLEARED] = 0;
  const cell = mem8[PLAYER_CELL] === 1 ? P1_LIVES : P2_LIVES;
  const c = (mem8[cell] + 1) & 0xff;
  mem8[cell] = c; mem8[MIRROR] = c; // BUG: never stamps the marker
}

test("EQUAL (crafted): awardExtraLife == oracle on every award path", { skip }, () => {
  const entries = CASES.map(([, p, cell, v]) => entry(p, cell, v));
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (const e of entries) assert.equal(ramDiff(awardExtraLife, e), null, "a crafted entry diverged");
  assert.ok(ramDiff(brokenNoOp, entry(1, P1_LIVES, 3)), "vacuous: oracle wrote nothing");
  console.log(`  EQUAL: ${entries.length} crafted award paths, awardExtraLife == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = entry(1, P1_LIVES, 3); // count -> 4, below the cap: stamps a marker
  assert.ok(bumpTo(e) === 4, "sanity: sample bumps to a below-cap count");
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongCount, e), "the wrong-count twin escaped");
  assert.ok(ramDiff(brokenNoMarker, e), "the no-marker twin escaped");
  console.log("  TEETH: no-op, wrong-count, no-marker all caught");
});
