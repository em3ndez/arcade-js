// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampHomeBaySlot — memory-equivalent to the frozen oracle at ROM 0x25CE.
 * GATE: crafted-entry. Plain attract does not dispatch this home-slot stamp within ENTRY_FRAMES
 * (probe: 0), and each arm is gated by the selector cell (0x8121, 1..5), so a post-boot attract
 * clone is poked to drive every selector (1..5 plus out-of-range), both players (0x83FD), the
 * clear/occupied gate cell, and the hold flag (0x8004). stampHomeBaySlot reads only work RAM (no register
 * live-in) and its live-out is memory-only, so registers/SP are not compared. Teeth: four broken
 * twins (no-op, wrong tile, forgets to clear the selector pair, ignores the hold flag).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { stampHomeBaySlot } from "../stampHomeBaySlot.js";
import { loc_25ce as oracle } from "../../translated/loc_25ce.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const SELECTOR = 0x8121;
const SELECTOR_COMPANION = 0x8120;
const PLAYER = 0x83fd;
const HOLD = 0x8004;
const HOME_TILE = 16;
// per selector value 1..5: [VRAM base, player-1 occupancy cell, player-2 occupancy cell]
const SLOTS = {
  1: [0xab64, 0x825e, 0x8263],
  2: [0xaaa4, 0x825f, 0x8264],
  3: [0xa9e4, 0x8260, 0x8265],
  4: [0xa924, 0x8261, 0x8266],
  5: [0xa864, 0x8262, 0x8267],
};
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

// A post-boot clone with the dispatch cells poked; every slot's four VRAM cells pre-cleared and the
// companion cell set to a sentinel, so both the tile writes and the selector clear are observable.
function entry({ sel, player, occ, hold }) {
  const e = seedMachine().clone();
  e.mem8[SELECTOR] = sel;
  e.mem8[SELECTOR_COMPANION] = 0x55;
  e.mem8[PLAYER] = player;
  e.mem8[HOLD] = hold;
  for (const [base, p1, p2] of Object.values(SLOTS)) {
    e.mem8[p1] = occ;
    e.mem8[p2] = occ;
    e.mem8[base] = e.mem8[(base + 1) & 0xffff] = 0;
    e.mem8[(base + 32) & 0xffff] = e.mem8[(base + 33) & 0xffff] = 0;
  }
  return e;
}

function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// broken twins.
function brokenNoOp() {}
function brokenWrongTile(m) {
  const { mem8 } = m;
  const [base] = SLOTS[mem8[SELECTOR]];
  mem8[base] = mem8[(base + 1) & 0xffff] = HOME_TILE + 1;
  mem8[(base + 32) & 0xffff] = mem8[(base + 33) & 0xffff] = HOME_TILE + 1;
  if (mem8[HOLD] === 0) { mem8[SELECTOR] = 0; mem8[SELECTOR_COMPANION] = 0; }
}
function stamp(m) {
  const { mem8 } = m;
  const [base] = SLOTS[mem8[SELECTOR]];
  mem8[base] = mem8[(base + 1) & 0xffff] = HOME_TILE;
  mem8[(base + 32) & 0xffff] = mem8[(base + 33) & 0xffff] = HOME_TILE;
}
function brokenNoClear(m) { stamp(m); } // stamps but never clears the selector pair
function brokenIgnoreHold(m) { stamp(m); m.mem8[SELECTOR] = 0; m.mem8[SELECTOR_COMPANION] = 0; }

test("EQUAL (crafted): stampHomeBaySlot == oracle on every selector/player/occupancy/hold path", { skip }, () => {
  const entries = [];
  for (const sel of [0, 1, 2, 3, 4, 5, 6]) {
    for (const player of [1, 2]) {
      for (const occ of [0, 7]) {
        for (const hold of [0, 1]) entries.push(entry({ sel, player, occ, hold }));
      }
    }
  }
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (const e of entries) assert.equal(ramDiff(stampHomeBaySlot, e), null, "a crafted entry diverged");
  console.log(`  EQUAL: ${entries.length} crafted paths, stampHomeBaySlot == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const stampEntry = entry({ sel: 1, player: 1, occ: 0, hold: 0 }); // stamps and clears
  assert.ok(ramDiff(brokenNoOp, stampEntry), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongTile, stampEntry), "the wrong-tile twin escaped");
  assert.ok(ramDiff(brokenNoClear, stampEntry), "the no-clear twin escaped");
  const heldEntry = entry({ sel: 1, player: 1, occ: 0, hold: 1 }); // stamps but must NOT clear
  assert.ok(ramDiff(brokenIgnoreHold, heldEntry), "the ignore-hold twin escaped");
  console.log("  TEETH: no-op, wrong-tile, no-clear, ignore-hold all caught");
});
