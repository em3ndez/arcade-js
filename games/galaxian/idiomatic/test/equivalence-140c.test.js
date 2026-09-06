// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_140c — crafted-entry equivalence vs the frozen delayed-spawn dispatch at ROM 0x140c.
 * Three gates guard it (region-clear flag clear, object subsystem enabled, delayed-event request pending);
 * on entry past them it consumes the request, and unless the object-table head word is even it holds. Armed,
 * the launch direction's low bit routes a full trigger-block spawn; otherwise it scans the primary trigger
 * block high->low (spawn a primary via spawnPrimaryAndSecondaryObjects) then the secondary window high->low
 * (seed a free descriptor slot). Every live-out is work RAM (the pipeline reads no registers back), so
 * ramDiff carries the verdict. Paths: full spawn, primary-block hit, secondary-window hit, a gated no-op,
 * and no flag anywhere (consume only). Teeth: no-op, and a wrong-route twin. Plus an SP-seam tooth on the
 * tail-dispatch and gated paths; a stack-adrift mutant is refused.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { loc_140c as cand } from "../loc_140c.js";
import { loc_140c as oracle } from "../../translated/loc_140c.js";
import { spawnIntoFreeDescriptorSlot } from "../spawnIntoFreeDescriptorSlot.js";

const REGION_GATE = 0x4220, ACTIVE = 0x4200, REQUEST = 0x4229;
const OBJHEAD = 0x42d0, DIR = 0x4215;
const PRIMARY = 0x4176;            // primary block, scanned 0x4179..0x4176
const G1_TOP = 0x4179;             // top cell of the primary-block scan
const G2_TOP = 0x416a;             // top cell of the secondary-window scan (0x416a..0x4167)
const OBJ = 0x42d0;                // primary object slot
const SEC1 = 0x42f0, SEC2 = 0x4310; // secondary slots for the full-spawn path
const D0 = 0x4390, D1 = 0x4370, D2 = 0x4350; // descriptor slots, scanned high->low
const F_ACTIVE = 0, F_PHASE = 2, F_SPAWN = 6, F_SOURCE = 7;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

function armGates(mem) {
  mem[REGION_GATE] = 0;                     // region-clear gate clear -> proceed
  mem[ACTIVE] = 1;                          // object subsystem enabled
  mem[REQUEST] = 1;                         // delayed-event request pending
  mem[OBJHEAD] = 0; mem[OBJHEAD + 1] = 0;   // object-table head word even
}
function clearFlags(mem) { for (let a = 0x4160; a <= 0x417f; a++) mem[a] = 0; }
function freeSlot(mem, base) { mem[base] = 0; mem[base + 1] = 0; mem[base + F_PHASE] = 7; }

// Direction low bit set -> full trigger-block spawn: primary flag 0 plus two secondary flags.
const dirSpawn = () => craft((mem, mm) => {
  mm.push16(0x9999);
  armGates(mem); clearFlags(mem);
  mem[DIR] = 1;
  mem[PRIMARY] = 1;
  mem[0x4165] = 1; mem[0x4166] = 1;
  mem[OBJ + F_PHASE] = 7;
  freeSlot(mem, SEC1); freeSlot(mem, SEC2);
});

// Direction low bit clear; a primary-block flag set at the top of the scan -> primary spawn.
const group1 = () => craft((mem, mm) => {
  mm.push16(0x9999);
  armGates(mem); clearFlags(mem);
  mem[DIR] = 2;
  mem[G1_TOP] = 1;
  mem[OBJ + F_PHASE] = 7;
});

// Direction low bit clear; no primary flag, a secondary-window flag at the top -> free-slot seed.
const group2 = () => craft((mem, mm) => {
  mm.push16(0x9999);
  armGates(mem); clearFlags(mem);
  mem[DIR] = 2;
  mem[G2_TOP] = 1;
  mem[D0] = 1; mem[D1] = 1;   // first two descriptor slots occupied
  freeSlot(mem, D2);          // third free -> seeded
});

// Region-clear gate set -> immediate return, the request is NOT consumed.
const gated = () => craft((mem, mm) => {
  mm.push16(0x9999);
  armGates(mem); clearFlags(mem);
  mem[REGION_GATE] = 1;
});

// All gates pass, direction low bit clear, no flag anywhere -> consume the request and return.
const noFlag = () => craft((mem, mm) => {
  mm.push16(0x9999);
  armGates(mem); clearFlags(mem);
  mem[DIR] = 2;
});

// Gates pass and the request is consumed, but the object-table head word is odd -> hold after the consume.
const oddHead = () => craft((mem, mm) => {
  mm.push16(0x9999);
  armGates(mem); clearFlags(mem);
  mem[OBJHEAD] = 1; // odd head word -> hold (the consume still happened first)
});

function runOracle(e) { e.routines = STUBS; oracle(e); return e; }

test("EQUAL (crafted): loc_140c == oracle across all five paths", { skip }, () => {
  for (const [name, e] of [["dirSpawn", dirSpawn()], ["group1", group1()], ["group2", group2()],
                           ["gated", gated()], ["noFlag", noFlag()], ["oddHead", oddHead()]]) {
    assert.equal(ramDiff(oracle, cand, e), null, `loc_140c diverged on the ${name} path`);
  }
  console.log("  EQUAL: loc_140c == oracle (RAM) on full spawn, primary hit, secondary hit, gated, no-flag, odd-head");
});

test("positive controls: each path does its work", { skip }, () => {
  const a = runOracle(dirSpawn());
  assert.equal(a.mem8[REQUEST], 0, "request not consumed (dir spawn)");
  assert.equal(a.mem8[PRIMARY], 0, "primary flag not consumed");
  assert.equal(a.mem8[OBJ + F_ACTIVE], 1, "primary object not activated");
  assert.equal(a.mem8[OBJ + F_SPAWN], 1, "spawn code (direction) not stored");
  assert.equal(a.mem8[OBJ + F_SOURCE], PRIMARY & 0xff, "primary source index wrong");
  assert.equal(a.mem8[SEC1], 1, "first secondary not spawned");
  assert.equal(a.mem8[SEC2], 1, "second secondary not spawned");

  const b = runOracle(group1());
  assert.equal(b.mem8[REQUEST], 0, "request not consumed (group1)");
  assert.equal(b.mem8[G1_TOP], 0, "primary-block flag not consumed");
  assert.equal(b.mem8[OBJ + F_ACTIVE], 1, "group1 primary not activated");
  assert.equal(b.mem8[OBJ + F_SPAWN], 2, "group1 spawn code not stored");
  assert.equal(b.mem8[OBJ + F_SOURCE], G1_TOP & 0xff, "group1 source index wrong");

  const c = runOracle(group2());
  assert.equal(c.mem8[REQUEST], 0, "request not consumed (group2)");
  assert.equal(c.mem8[G2_TOP], 0, "secondary-window flag not consumed");
  assert.equal(c.mem8[D2 + F_ACTIVE], 1, "descriptor slot not seeded");
  assert.equal(c.mem8[D2 + F_PHASE], 0, "descriptor phase not cleared");
  assert.equal(c.mem8[D2 + F_SPAWN], 2, "group2 spawn code not stored");
  assert.equal(c.mem8[D2 + F_SOURCE], G2_TOP & 0xff, "group2 source index wrong");

  const noOp = () => {};
  assert.equal(ramDiff(oracle, noOp, gated()), null, "gated path wrote memory");
  const g = runOracle(gated());
  assert.equal(g.mem8[REQUEST], 1, "gated path consumed the request");

  const n = runOracle(noFlag());
  assert.equal(n.mem8[REQUEST], 0, "no-flag path did not consume the request");

  const o = runOracle(oddHead());
  assert.equal(o.mem8[REQUEST], 0, "odd-head path did not consume the request before holding");
  assert.equal(o.mem8[OBJHEAD], 1, "odd-head path disturbed the head word");
  console.log("  positive: gates hold, request consumed once past them, each route lands its spawn");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  // Routes a primary-block hit into the free-slot seeder instead of the primary spawner.
  const wrongRoute = (m) => { m.mem8[REQUEST] = 0; spawnIntoFreeDescriptorSlot(m, G1_TOP, m.mem8[DIR]); };
  assert.ok(ramDiff(oracle, noOp, dirSpawn()), "no-op escaped (dir spawn)");
  assert.ok(ramDiff(oracle, noOp, noFlag()), "no-op escaped (consume-only)");
  assert.ok(ramDiff(oracle, wrongRoute, group1()), "wrong-route twin escaped (group1)");
  console.log("  TEETH: no-op (spawn + consume) and wrong-route all caught");
});

test("SP-SEAM TOOTH: the stack-neutral body places at the dispatch seam", { skip }, () => {
  for (const [name, e] of [["dirSpawn", dirSpawn()], ["group2", group2()], ["gated", gated()]]) {
    const r = seamPlaceable(withOmittedRet, cand, 0x140c, e);
    assert.equal(r.placeable, true, `${name}: seam refused the stack-neutral body: ${r.error}`);
  }
  const popping = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, popping, 0x140c, group2());
  assert.equal(rm.placeable, false, "the stack-adrift mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral body places on dir spawn + group2 + gated; stack-adrift mutant refused");
});
