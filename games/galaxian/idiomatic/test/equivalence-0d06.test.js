// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0d06 — crafted-entry equivalence vs the frozen object spawn/init handler.
 * Live-out is memory only: the object record at IX (sprite#, curve seed, attr base, motion counters,
 * heading, sub-state), the spawn flag 0x41c2, the active-neighbour tally 0x422a on the top-row path,
 * and the command word appended to the queue at 0x40a0 (delegates positionObjectFromGridCell + the
 * enqueue). ramDiff covers it all (stack window masked). Three scenarios drive the non-top row, the
 * top row with one neighbour, and the top row with both. Positive controls prove the oracle mutates;
 * teeth show a no-op, a wrong sprite#, a miscounted neighbour tally, and a lost state bump each diverge.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { initSpawnedObjectFromGridCell as cand } from "../initSpawnedObjectFromGridCell.js";
import { loc_0d06 as oracle } from "../../translated/loc_0d06.js";
import { loc_41c2, ACTIVE_NEIGHBOR_COUNT, OBJ_TABLE, loc_40a0, loc_4000 } from "../names.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const OBJ = OBJ_TABLE; // object-record base seated in IX
const SPAWN_TABLE = 0x1dd1; // ROM per-row {sprite#, curve seed} record table
const HEAD_START = 0xc0; // free queue write-head we seat
const SLOT = loc_4000 + HEAD_START;

// Record fields.
const F_STATE = 2, F_HEADING = 5, F_DIR = 6, F_CELL = 7, F_ATTR = 15;
const F_THROTTLE = 16, F_LEG = 17, F_TIMER = 23, F_CURSOR = 19, F_SPRITE = 22, F_CURVE = 24;
const F_NEXT = 32, F_SECOND = 64;

// Seat IX at a record, lay the handler's return address, seed a free queue head, and drive one branch.
function scenario(setup) {
  return craft((mem, mm) => {
    mm.push16(0x9999);
    mm.regs.ix = OBJ;
    mem[loc_40a0] = HEAD_START;
    mem[SLOT] = 0x80; // slot free (bit 7)
    setup(mem);
  });
}

// Non-top row (row bits 0x50 -> record index 10), direction bit clear -> heading +12.
const nonTop = () => scenario((mem) => { mem[OBJ + F_CELL] = 0x53; mem[OBJ + F_DIR] = 0x00; });
// Top row (row bits 0x70 -> index 14), one active neighbour, direction bit set -> heading -12.
const topOne = () => scenario((mem) => {
  mem[OBJ + F_CELL] = 0x71; mem[OBJ + F_DIR] = 0x01;
  mem[OBJ + F_NEXT] = 0x01; mem[OBJ + F_SECOND] = 0x00;
});
// Top row, both neighbours active -> tally 2.
const topBoth = () => scenario((mem) => {
  mem[OBJ + F_CELL] = 0x70; mem[OBJ + F_DIR] = 0x00;
  mem[OBJ + F_NEXT] = 0x01; mem[OBJ + F_SECOND] = 0x01;
});

function runOracle(entry) {
  const a = entry.clone(); a.routines = STUBS; oracle(a); return a;
}

test("EQUAL (crafted): loc_0d06 == oracle across every spawn branch", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, nonTop()), null, "diverged on non-top row");
  assert.equal(ramDiff(oracle, cand, topOne()), null, "diverged on top row, one neighbour");
  assert.equal(ramDiff(oracle, cand, topBoth()), null, "diverged on top row, both neighbours");
  console.log("  EQUAL: loc_0d06 == oracle on non-top / top-one / top-both");
});

test("positive controls: the oracle actually mutates on each branch", { skip }, () => {
  let e = nonTop();
  let a = runOracle(e);
  assert.equal(a.mem8[loc_41c2], 1, "spawn flag not raised");
  assert.equal(a.mem8[OBJ + F_SPRITE], 3, "sprite# not from table[10]");
  assert.equal(a.mem8[OBJ + F_CURVE], 3, "curve seed not from table[11]");
  assert.equal(a.mem8[OBJ + F_ATTR], 0, "non-top attr base should be 0");
  assert.equal(a.mem8[OBJ + F_THROTTLE], 3, "throttle not seeded");
  assert.equal(a.mem8[OBJ + F_LEG], 12, "leg count not seeded");
  assert.equal(a.mem8[OBJ + F_CURSOR], 0, "walk cursor not cleared");
  assert.equal(a.mem8[OBJ + F_TIMER], 0, "step timer not cleared");
  assert.equal(a.mem8[OBJ + F_HEADING], 12, "heading sign wrong (dir clear)");
  assert.equal(a.mem8[OBJ + F_STATE], (e.mem8[OBJ + F_STATE] + 1) & 0xff, "state not advanced");
  assert.equal(a.mem8[SLOT], 1, "command hi byte not enqueued");
  assert.equal(a.mem8[loc_4000 + HEAD_START + 1], 0x53, "command lo byte (cell) not enqueued");
  assert.equal(a.mem8[loc_40a0], (HEAD_START + 2) & 0xff, "write-head not advanced");

  a = runOracle(topOne());
  assert.equal(a.mem8[ACTIVE_NEIGHBOR_COUNT], 1, "top-row tally should be 1");
  assert.equal(a.mem8[OBJ + F_ATTR], 24, "top-row attr base should be 24");
  assert.equal(a.mem8[OBJ + F_SPRITE], 1, "sprite# not from table[14]");
  assert.equal(a.mem8[OBJ + F_CURVE], 2, "curve seed not from table[15]");
  assert.equal(a.mem8[OBJ + F_HEADING], (-12) & 0xff, "heading sign wrong (dir set)");

  a = runOracle(topBoth());
  assert.equal(a.mem8[ACTIVE_NEIGHBOR_COUNT], 2, "top-row tally should be 2");

  // The table bytes the lookups depend on really are what we claim.
  assert.equal(e.mem8[SPAWN_TABLE + 10], 3, "control: table[10]");
  assert.equal(e.mem8[SPAWN_TABLE + 14], 1, "control: table[14]");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongSprite = (m) => { oracle(m); m.mem8[m.regs.ix + F_SPRITE] ^= 1; };
  const wrongTally = (m) => { oracle(m); m.mem8[ACTIVE_NEIGHBOR_COUNT] ^= 1; };
  const lostBump = (m) => { oracle(m); m.mem8[m.regs.ix + F_STATE] = (m.mem8[m.regs.ix + F_STATE] - 1) & 0xff; };
  const skipEnqueue = (m) => { oracle(m); m.mem8[SLOT] = 0x80; }; // undo the enqueued hi byte

  assert.ok(ramDiff(oracle, noOp, nonTop()), "no-op escaped");
  assert.ok(ramDiff(oracle, wrongSprite, nonTop()), "wrong-sprite escaped");
  assert.ok(ramDiff(oracle, wrongTally, topOne()), "wrong-tally escaped");
  assert.ok(ramDiff(oracle, lostBump, nonTop()), "lost-state-bump escaped");
  assert.ok(ramDiff(oracle, skipEnqueue, nonTop()), "skipped-enqueue escaped");
  console.log("  TEETH: no-op, wrong-sprite, wrong-tally, lost-bump, skipped-enqueue all caught");
});
