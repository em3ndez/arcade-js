// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_07e8 — crafted-entry memory-equivalence vs the frozen sub-state-6 handler.
 * The routine only writes work RAM / the command queue (the two delegates it may tail into paint no
 * pixels here), and it is a state-table handler whose caller reads no register back, so ramDiff is the
 * whole live-out (return-stack window masked). Five paths, keyed on the show flag (0x421d), the advance
 * gate (0x4195), and the sound-enable bit (0x4006 bit0):
 *   A show set,  gate closed -> set the sequence state by mode + reload the dwell.
 *   B show set,  gate open   -> advance the sub-state, reload the dwell to 80.
 *   C show clear, gate closed -> the shared dwell/reset tail (advance sub-path here).
 *   D show clear, gate open, sound bit clear -> advance, reload the dwell to 130, no sound.
 *   E show clear, gate open, sound bit set   -> advance, reload to 130, queue two sound words.
 * Positive controls prove each path is non-vacuous; teeth show a no-op, a timer scribble, a wrong
 * delegate on path C, and a soundless twin on path E each diverge.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_07e8 as cand } from "../loc_07e8.js";
import { loc_07e8 as oracle } from "../../translated/loc_07e8.js";
import { SEQUENCE_STATE } from "../names.js";
import { setSequenceStateByModeAndReloadDwell } from "../setSequenceStateByModeAndReloadDwell.js";

const SHOW = 0x421d, GATE = 0x4195, STATE = 0x400a, DWELL = 0x4009, MODE = 0x4006;
const HEAD = 0x40a0, SLOT0 = 0x40c0, SLOT1 = 0x40c2, SENT = 0x11;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const pathA = () => craft((mem, mm) => {
  mem[SHOW] = 1; mem[GATE] = 0; mem[MODE] = 0; mem[STATE] = 5; mem[DWELL] = SENT;
  mm.push16(0x9999);
});
const pathB = () => craft((mem, mm) => {
  mem[SHOW] = 1; mem[GATE] = 1; mem[STATE] = 5; mem[DWELL] = SENT;
  mm.push16(0x9999);
});
const pathC = () => craft((mem, mm) => {
  mem[SHOW] = 0; mem[GATE] = 0; mem[MODE] = 0; mem[STATE] = 3; mem[DWELL] = SENT;
  mm.push16(0x9999);
});
const pathD = () => craft((mem, mm) => {
  mem[SHOW] = 0; mem[GATE] = 1; mem[MODE] = 0; mem[STATE] = 5; mem[DWELL] = SENT;
  mm.push16(0x9999);
});
const pathE = () => craft((mem, mm) => {
  mem[SHOW] = 0; mem[GATE] = 1; mem[MODE] = 1; mem[STATE] = 5; mem[DWELL] = SENT;
  mem[HEAD] = 0xc0; mem[SLOT0] = 0x80; mem[SLOT1] = 0x80; // free queue head, two open slots
  mm.push16(0x9999);
});

const runOracle = (e) => { e.routines = STUBS; oracle(e); return e; };

test("EQUAL (crafted): loc_07e8 == oracle on all five paths", { skip }, () => {
  for (const [name, e] of [["A", pathA], ["B", pathB], ["C", pathC], ["D", pathD], ["E", pathE]]) {
    assert.equal(ramDiff(oracle, cand, e()), null, `path ${name} diverged in RAM`);
  }
  console.log("  EQUAL: loc_07e8 == oracle (RAM) on paths A-E");
});

test("positive controls: each path is non-vacuous", { skip }, () => {
  const a = runOracle(pathA());
  assert.equal(a.mem8[STATE], 14, "A: state not set by mode (0x4006 bit0 clear -> 14)");
  assert.equal(a.mem8[DWELL], 80, "A: dwell not reloaded");

  const b = runOracle(pathB());
  assert.equal(b.mem8[STATE], 6, "B: sub-state not advanced");
  assert.equal(b.mem8[DWELL], 80, "B: dwell not reloaded to 80");

  const c = runOracle(pathC());
  assert.equal(c.mem8[STATE], 4, "C: sub-state not advanced by the delegate");
  assert.equal(c.mem8[DWELL], 80, "C: delegate did not reload the dwell");

  const d = runOracle(pathD());
  assert.equal(d.mem8[STATE], 6, "D: sub-state not advanced");
  assert.equal(d.mem8[DWELL], 130, "D: dwell not reloaded to 130");
  assert.equal(d.mem8[HEAD], craft().mem8[HEAD], "D: queue head moved without sound");

  const e = runOracle(pathE());
  assert.equal(e.mem8[STATE], 6, "E: sub-state not advanced");
  assert.equal(e.mem8[DWELL], 130, "E: dwell not reloaded to 130");
  assert.equal(e.mem8[SLOT0], 6, "E: first sound word hi not queued");
  assert.equal(e.mem8[SLOT0 + 1], 3, "E: first sound word lo not queued");
  assert.equal(e.mem8[SLOT1], 6, "E: second sound word hi not queued");
  assert.equal(e.mem8[SLOT1 + 1], 0, "E: second sound word lo not queued");
  assert.equal(e.mem8[HEAD], 0xc4, "E: write-head not advanced past both words");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const scribble = (m) => { cand(m); m.mem8[DWELL] ^= 0xff; };
  const wrongDelegate = (m) => setSequenceStateByModeAndReloadDwell(m, SEQUENCE_STATE); // C should reset/advance
  const soundless = (m) => { m.mem8[STATE] = m.mem8[STATE] + 1; m.mem8[DWELL] = 130; }; // E without the queue

  assert.ok(ramDiff(oracle, noOp, pathB()), "no-op escaped");
  assert.ok(ramDiff(oracle, scribble, pathB()), "timer scribble escaped");
  assert.ok(ramDiff(oracle, wrongDelegate, pathC()), "wrong delegate on path C escaped");
  assert.ok(ramDiff(oracle, soundless, pathE()), "soundless twin on path E escaped");
  console.log("  TEETH: no-op, scribble, wrong-delegate (C), soundless (E) all caught");
});
