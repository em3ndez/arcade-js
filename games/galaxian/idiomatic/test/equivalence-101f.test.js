// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_101f — memory-equivalent to the frozen oracle at ROM 0x101f (descending path-walk handler).
 * Live-out is the object record (RAM) only, so ramDiff covers it. IX points into clean work RAM below
 * the masked stack window so every field write is visible. Four paths:
 *   A DESCENDING, throttle not expired: X/Y deltas applied, cursor +2, throttle--.
 *   B DESCENDING, throttle expires but leg survives: throttle reload, heading--, leg--.
 *   C DESCENDING, leg finishes: state++, throttle/leg/heading/cursor reloaded.
 *   D ASCENDING (dir bit0 set): X delta applied, then the Y half handed to the ascending arm.
 * Teeth: no-op, wrong-sign X delta, and a throttle-not-ticked twin. Positive controls read the fields.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { advanceObjectPathStepDescending as cand } from "../advanceObjectPathStepDescending.js";
import { loc_101f as oracle } from "../../translated/loc_101f.js";
import { PATH_STEP_TABLE } from "../names.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const REC = 0x4380;   // object record base: clean work RAM, all fields below the masked 0x43e0 window
const STATE = 2, X = 3, Y = 4, ANGLE = 5, DIR = 6, THROTTLE = 16, LEG = 17, CURSOR = 19;
const CUR = 12;       // step-table cursor (both delta bytes here are nonzero)

const base = (mut) => craft((mem, m) => {
  mem[REC + STATE] = 1;
  mem[REC + X] = 100;
  mem[REC + Y] = 100;
  mem[REC + ANGLE] = 50;
  mem[REC + DIR] = 0;         // descending by default
  mem[REC + THROTTLE] = 5;
  mem[REC + LEG] = 8;
  mem[REC + CURSOR] = CUR;
  m.regs.ix = REC;
  m.push16(0x9999);
  if (mut) mut(mem, m);
});

const descRun = () => base();                                              // A: throttle 5->4
const throttleExpires = () => base((mem) => { mem[REC + THROTTLE] = 1; });  // B: throttle 1->0, leg survives
const legFinishes = () => base((mem) => { mem[REC + THROTTLE] = 1; mem[REC + LEG] = 1; }); // C
const ascend = () => base((mem) => { mem[REC + DIR] = 1; });               // D: direction bit set

test("EQUAL (crafted): loc_101f == oracle, descending throttle tick", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, descRun()), null, "path A diverged");
  const e = descRun();
  const stepX = e.mem8[PATH_STEP_TABLE + CUR];
  const stepY = e.mem8[PATH_STEP_TABLE + CUR + 1];
  oracle(e);
  assert.equal(e.mem8[REC + X], (100 - stepX) & 0xff, "positive control: X delta applied");
  assert.equal(e.mem8[REC + Y], (100 - stepY) & 0xff, "positive control: Y delta applied");
  assert.equal(e.mem8[REC + CURSOR], (CUR + 2) & 0xff, "positive control: cursor advanced by two");
  assert.equal(e.mem8[REC + THROTTLE], 4, "positive control: throttle decremented");
  console.log("  EQUAL: path A (descending, throttle tick)");
});

test("EQUAL (crafted): loc_101f == oracle, throttle expires, leg survives", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, throttleExpires()), null, "path B diverged");
  const e = throttleExpires(); oracle(e);
  assert.equal(e.mem8[REC + THROTTLE], 4, "positive control: throttle reloaded to 4");
  assert.equal(e.mem8[REC + ANGLE], 49, "positive control: heading stepped down");
  assert.equal(e.mem8[REC + LEG], 7, "positive control: leg counter ticked");
  assert.equal(e.mem8[REC + STATE], 1, "positive control: state held (leg not finished)");
  console.log("  EQUAL: path B (throttle expires, leg survives)");
});

test("EQUAL (crafted): loc_101f == oracle, leg finishes -> state advance", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, legFinishes()), null, "path C diverged");
  const e = legFinishes(); oracle(e);
  assert.equal(e.mem8[REC + STATE], 2, "positive control: state advanced");
  assert.equal(e.mem8[REC + THROTTLE], 3, "positive control: throttle reloaded to 3");
  assert.equal(e.mem8[REC + LEG], 12, "positive control: leg reloaded to 12");
  assert.equal(e.mem8[REC + ANGLE], 12, "positive control: heading reloaded to 12");
  assert.equal(e.mem8[REC + CURSOR], 0, "positive control: cursor reset");
  console.log("  EQUAL: path C (leg finishes)");
});

test("EQUAL (crafted): loc_101f == oracle, ascending arm handoff", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, ascend()), null, "path D diverged");
  const e = ascend();
  const stepX = e.mem8[PATH_STEP_TABLE + CUR];
  const stepY = e.mem8[PATH_STEP_TABLE + CUR + 1];
  oracle(e);
  assert.equal(e.mem8[REC + X], (100 - stepX) & 0xff, "positive control: X delta applied before handoff");
  assert.equal(e.mem8[REC + Y], (100 + stepY) & 0xff, "positive control: ascending arm added the Y delta");
  console.log("  EQUAL: path D (ascending handoff)");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongSignX = (m) => { // adds the X delta instead of subtracting
    const c = m.mem8[REC + CURSOR];
    m.mem8[REC + X] = m.mem8[REC + X] + m.mem8[PATH_STEP_TABLE + c];
    m.mem8[REC + Y] = m.mem8[REC + Y] - m.mem8[PATH_STEP_TABLE + ((c + 1) & 0xff)];
    m.mem8[REC + CURSOR] = c + 2;
    m.mem8[REC + THROTTLE] = m.mem8[REC + THROTTLE] - 1;
  };
  const noThrottleTick = (m) => { // applies deltas + cursor but never ticks the throttle
    const c = m.mem8[REC + CURSOR];
    m.mem8[REC + X] = m.mem8[REC + X] - m.mem8[PATH_STEP_TABLE + c];
    m.mem8[REC + Y] = m.mem8[REC + Y] - m.mem8[PATH_STEP_TABLE + ((c + 1) & 0xff)];
    m.mem8[REC + CURSOR] = c + 2;
  };
  assert.ok(ramDiff(oracle, noOp, descRun()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongSignX, descRun()), "the wrong-sign-X twin escaped");
  assert.ok(ramDiff(oracle, noThrottleTick, descRun()), "the throttle-not-ticked twin escaped");
  console.log("  TEETH: no-op, wrong-sign X, throttle-not-ticked all caught");
});
