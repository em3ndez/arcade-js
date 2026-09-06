// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0e99 — crafted-entry equivalence vs the frozen formation-object state handler.
 * Live-out is memory only: the object record at IX (X/Y/heading/state/timer/leg fields, active flag)
 * plus the globals it touches and the PRNG seed advanced on the reseed path — all compared by ramDiff
 * (the return-stack window is masked). Five scenarios drive every branch; positive controls prove the
 * oracle really mutates on each; teeth show a skipped init, a wrong Y, a lost state bump, and an
 * over-ramped counter each diverge.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, STUBS } from "./_bootSetup.js";
import { reseedFormationObjectState as cand } from "../reseedFormationObjectState.js";
import { loc_0e99 as oracle } from "../../translated/loc_0e99.js";
import {
  OBJ_TABLE,
  OBJ_ACTIVE_FLAG,
  loc_4224,
  loc_4221,
  loc_421e,
  ACTIVE_NEIGHBOR_COUNT,
  RNG_SEED,
} from "../names.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const OBJ = OBJ_TABLE;

// Seat IX at an object record, lay the handler's return address, and drive one branch.
function scenario(setup) {
  return craft((mem, mm) => {
    mm.push16(0x9999);
    mm.regs.ix = OBJ;
    setup(mem);
  });
}

// Reseed path: cell high bits not all set, enabled + activity gate open -> roll Y, advance twice.
const reseed = () => scenario((mem) => {
  mem[OBJ + 7] = 0x00;
  mem[OBJ_ACTIVE_FLAG] = 0x01;
  mem[loc_4224] = 0x01;
  mem[OBJ + 4] = 0x40;
  mem[OBJ + 2] = 0x00;
  mem[RNG_SEED] = 0x37;
});

// Idle path: enable bit clear -> a single state bump, no reseed.
const idle = () => scenario((mem) => {
  mem[OBJ + 7] = 0x00;
  mem[OBJ_ACTIVE_FLAG] = 0x00;
  mem[OBJ + 2] = 0x03;
});

// Ramp/clamp: cell high bits set, no neighbors left -> clear active, clamp the phase counter at 2.
const rampClamp = () => scenario((mem) => {
  mem[OBJ + 7] = 0x70;
  mem[ACTIVE_NEIGHBOR_COUNT] = 0x00;
  mem[loc_421e] = 0x05; // +1 -> 6, clamped to 2
  mem[OBJ + 0] = 0x01;
});

// Ramp wrap edge: counter at 0xff -> +1 wraps to 0 (below the ceiling, kept as-is).
const rampWrap = () => scenario((mem) => {
  mem[OBJ + 7] = 0x70;
  mem[ACTIVE_NEIGHBOR_COUNT] = 0x00;
  mem[loc_421e] = 0xff;
  mem[OBJ + 0] = 0x01;
});

// Recount + reseed: cell high bits set, neighbors still counted -> recount, then reseed via the
// 0x4221 arm of the activity gate (0x4224 == 0).
const recountReseed = () => scenario((mem) => {
  mem[OBJ + 7] = 0x70;
  mem[ACTIVE_NEIGHBOR_COUNT] = 0x02;
  mem[OBJ + 0x20] = 0x01;
  mem[OBJ + 0x40] = 0x00;
  mem[OBJ_ACTIVE_FLAG] = 0x01;
  mem[loc_4224] = 0x00;
  mem[loc_4221] = 0x01;
  mem[OBJ + 4] = 0x50;
  mem[RNG_SEED] = 0x11;
});

const cases = [
  ["reseed", reseed],
  ["idle", idle],
  ["ramp-clamp", rampClamp],
  ["ramp-wrap", rampWrap],
  ["recount+reseed", recountReseed],
];

function runOracle(entry) {
  const a = entry.clone();
  a.routines = STUBS;
  oracle(a);
  return a;
}

test("EQUAL (crafted): loc_0e99 == oracle across every branch", { skip }, () => {
  for (const [name, mk] of cases) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `diverged on ${name}`);
  }
  console.log("  EQUAL: loc_0e99 == oracle on reseed/idle/ramp-clamp/ramp-wrap/recount");
});

test("positive controls: the oracle actually mutates on each branch", { skip }, () => {
  let e = reseed();
  let a = runOracle(e);
  assert.notEqual(a.mem8[RNG_SEED], e.mem8[RNG_SEED], "seed not advanced");
  assert.equal(a.mem8[OBJ + 2], (e.mem8[OBJ + 2] + 2) & 0xff, "state not advanced twice");
  assert.equal(a.mem8[OBJ + 3], 8, "X not re-initialized");

  e = idle();
  a = runOracle(e);
  assert.equal(a.mem8[OBJ + 2], (e.mem8[OBJ + 2] + 1) & 0xff, "state not advanced once");

  a = runOracle(rampClamp());
  assert.equal(a.mem8[loc_421e], 2, "phase counter not clamped to 2");
  assert.equal(a.mem8[OBJ + 0], 0, "active flag not cleared");

  a = runOracle(rampWrap());
  assert.equal(a.mem8[loc_421e], 0, "wrap edge not honored");

  a = runOracle(recountReseed());
  assert.equal(a.mem8[ACTIVE_NEIGHBOR_COUNT], 1, "neighbor tally miscounted");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  // Ticks the leg counter and clears heading but forgets the X re-init.
  const skipInit = (m) => { const o = m.regs.ix; m.mem8[o + 23] = m.mem8[o + 23] + 1; m.mem8[o + 5] = 0; };
  const wrongY = (m) => { oracle(m); m.mem8[m.regs.ix + 4] ^= 1; };
  const singleBump = (m) => { oracle(m); m.mem8[m.regs.ix + 2] = (m.mem8[m.regs.ix + 2] - 1) & 0xff; };
  const overRamp = (m) => { oracle(m); m.mem8[loc_421e] = (m.mem8[loc_421e] + 1) & 0xff; };

  assert.ok(ramDiff(oracle, noOp, reseed()), "no-op escaped");
  assert.ok(ramDiff(oracle, skipInit, reseed()), "skipped-init escaped");
  assert.ok(ramDiff(oracle, wrongY, reseed()), "wrong-Y escaped");
  assert.ok(ramDiff(oracle, singleBump, reseed()), "single-bump escaped");
  assert.ok(ramDiff(oracle, overRamp, rampClamp()), "over-ramp escaped");
  console.log("  TEETH: no-op, skipped-init, wrong-Y, single-bump, over-ramp all caught");
});
