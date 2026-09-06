// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_14be — crafted-entry equivalence vs the frozen spawn dispatcher at ROM 0x14be.
 * First scans the primary trigger block 0x4176..0x4179; the first set flag seeds a primary object at
 * 0x42d0 and walks the remapped secondary block 0x4165.. spawning up to two secondaries into 0x42f0,
 * 0x4310. If no primary flag is set it scans the secondary block 0x4165..0x4168 and tail-dispatches the
 * first set flag into the free-descriptor placement. All live-outs are work RAM (the caller's pipeline
 * reads none of its registers back), so ramDiff carries the verdict. Paths: spawn arm (two secondaries),
 * spawn arm with three secondary flags (budget caps it at two -> the third flag survives), the second-scan
 * tail placement, and no flag anywhere. Teeth: no-op, and a budget-ignoring twin that spawns a third.
 * Plus an SP-seam tooth on the tail-dispatch and plain-ret paths; a stack-adrift mutant is refused.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { loc_14be as cand } from "../loc_14be.js";
import { loc_14be as oracle } from "../../translated/loc_14be.js";
import { activateObjectSlotAndEnqueueSpawn } from "../activateObjectSlotAndEnqueueSpawn.js";
import { spawnSecondaryObjectIntoSlot } from "../spawnSecondaryObjectIntoSlot.js";

const PRIMARY = 0x4176, SECONDARY = 0x4165;
const OBJ = 0x42d0, SLOT1 = 0x42f0, SLOT2 = 0x4310, SLOT3 = 0x4330;
const DESC_HI = 0x4390, DESC_2 = 0x4370, DESC_FREE = 0x4350; // scan order high->low; DESC_FREE is free
const SPAWN = 0x25;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

function clearBlocks(mem) {
  for (let i = 0; i < 4; i++) { mem[PRIMARY + i] = 0; mem[SECONDARY + i] = 0; }
}
function freeSlot(mem, base) { mem[base] = 0; mem[base + 1] = 0; mem[base + 2] = 7; }

// Primary flag 0 set; two secondary flags set -> two secondaries spawned into SLOT1, SLOT2.
const spawnArm = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.c = SPAWN;
  clearBlocks(mem);
  mem[PRIMARY] = 1;
  mem[SECONDARY] = 1; mem[SECONDARY + 1] = 1;
  mem[OBJ + 2] = 7;              // state, observe the activate clear
  freeSlot(mem, SLOT1); freeSlot(mem, SLOT2);
});

// Primary flag 0 set; all three secondary flags set with three free slots. Budget caps spawns at two:
// SLOT3 stays untouched and SECONDARY+2 stays set.
const spawnArm3 = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.c = SPAWN;
  clearBlocks(mem);
  mem[PRIMARY] = 1;
  mem[SECONDARY] = 1; mem[SECONDARY + 1] = 1; mem[SECONDARY + 2] = 1;
  mem[OBJ + 2] = 7;
  freeSlot(mem, SLOT1); freeSlot(mem, SLOT2); freeSlot(mem, SLOT3);
});

// No primary flag; first secondary flag set -> tail placement into a free descriptor slot.
const secondScan = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.c = SPAWN;
  clearBlocks(mem);
  mem[SECONDARY] = 1;
  mem[DESC_HI] = 1; mem[DESC_2] = 1;      // occupied
  mem[DESC_FREE] = 0; mem[DESC_FREE + 1] = 0; mem[DESC_FREE + 2] = 7; // free
});

// Nothing armed anywhere.
const noFlag = () => craft((mem, mm) => { mm.push16(0x9999); mm.regs.c = SPAWN; clearBlocks(mem); });

test("EQUAL (crafted): loc_14be == oracle across all four paths", { skip }, () => {
  for (const [name, e] of [["spawnArm", spawnArm], ["spawnArm3", spawnArm3], ["secondScan", secondScan], ["noFlag", noFlag]]) {
    assert.equal(ramDiff(oracle, cand, e()), null, `loc_14be diverged on the ${name} path`);
  }
});

test("positive controls: each path does its work", { skip }, () => {
  const a = spawnArm(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[PRIMARY], 0, "primary flag not consumed");
  assert.equal(a.mem8[OBJ], 1, "primary object not activated");
  assert.equal(a.mem8[OBJ + 2], 0, "primary state not cleared");
  assert.equal(a.mem8[OBJ + 6], SPAWN, "spawn code not stored on the primary");
  assert.equal(a.mem8[OBJ + 7], PRIMARY & 0xff, "primary source index wrong");
  assert.equal(a.mem8[SLOT1], 1, "first secondary not activated");
  assert.equal(a.mem8[SLOT1 + 7], SECONDARY & 0xff, "first secondary source index wrong");
  assert.equal(a.mem8[SLOT2], 1, "second secondary not activated");
  assert.equal(a.mem8[SLOT2 + 7], (SECONDARY + 1) & 0xff, "second secondary source index wrong");
  assert.equal(a.mem8[SECONDARY], 0, "first secondary flag not consumed");
  assert.equal(a.mem8[SECONDARY + 1], 0, "second secondary flag not consumed");

  const b = spawnArm3(); b.routines = STUBS; oracle(b);
  assert.equal(b.mem8[SLOT2], 1, "budget: second secondary not spawned");
  assert.equal(b.mem8[SLOT3], 0, "budget: third slot spawned past the cap");
  assert.equal(b.mem8[SECONDARY + 2], 1, "budget: third secondary flag consumed past the cap");

  const c = secondScan(); c.routines = STUBS; oracle(c);
  assert.equal(c.mem8[SECONDARY], 0, "second-scan trigger not consumed");
  assert.equal(c.mem8[DESC_FREE], 1, "free descriptor slot not seeded");
  assert.equal(c.mem8[DESC_FREE + 6], SPAWN, "second-scan spawn code not stored");
  assert.equal(c.mem8[DESC_FREE + 7], SECONDARY & 0xff, "second-scan source index wrong");

  const noOp = () => {};
  assert.equal(ramDiff(oracle, noOp, noFlag()), null, "no-flag path wrote memory");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  // Budget-ignoring twin: spawns a secondary for every set flag with no cap of two.
  const noCap = (m) => {
    activateObjectSlotAndEnqueueSpawn(m, PRIMARY, OBJ, m.regs.c);
    let slot = SLOT1;
    for (let j = 0; j < 3; j++) {
      if (m.mem8[SECONDARY + j] & 1) {
        spawnSecondaryObjectIntoSlot(m, slot, OBJ, SECONDARY + j);
        slot += 0x20;
      }
    }
  };
  assert.ok(ramDiff(oracle, noOp, spawnArm()), "no-op twin escaped (spawn arm)");
  assert.ok(ramDiff(oracle, noOp, secondScan()), "no-op twin escaped (second scan)");
  assert.ok(ramDiff(oracle, noCap, spawnArm3()), "budget-ignoring twin escaped");
});

test("SP-SEAM TOOTH: the stack-neutral body places at the dispatch seam", { skip }, () => {
  for (const [name, e] of [["secondScan", secondScan], ["spawnArm", spawnArm], ["noFlag", noFlag]]) {
    const r = seamPlaceable(withOmittedRet, cand, 0x14be, e());
    assert.equal(r.placeable, true, `${name}: seam refused the stack-neutral body: ${r.error}`);
  }
  const popping = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, popping, 0x14be, secondScan());
  assert.equal(rm.placeable, false, "the stack-adrift mutant placed at the seam (tooth has no teeth)");
});
