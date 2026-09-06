// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_04bc — crafted-entry equivalence vs the frozen start/spawn setup at ROM 0x04bc.
 * Memory-only live-outs: the 16-bit spawn pointer (0x400d/0x400e from HL), the 32-byte template blit
 * into 0x4180, the seeded state cells (0x400a/0x4005/0x4006/0x41d1), the enqueued command words in the
 * command queue, and — only when config 0x401f bit0 is set — the armed gate 0x4195. No register/io
 * live-out the caller reads. Two paths: config bit set (gate armed) and clear (gate skipped).
 * Teeth: a no-op twin, a wrong pointer byte, a perturbed template, and a mis-armed gate on each path.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { startGameRoundAndClearScores as cand } from "../startGameRoundAndClearScores.js";
import { loc_04bc as oracle } from "../../translated/loc_04bc.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const PTR = 0x1234;
const PTR_LO = 0x400d;
const PTR_HI = 0x400e;
const TEMPLATE_SRC = 0x051b;
const TEMPLATE_DST = 0x4180;
const CONFIG = 0x401f;
const GATE = 0x4195;
const SEQ_STATE = 0x400a;
const GAME_STATE = 0x4005;
const MODE_FLAG = 0x4006;
const SPAWN_FLAG = 0x41d1;

// HL = spawn pointer, template destination dirtied so the blit is observable.
function seed(configBit) {
  return craft((mem, mm) => {
    mm.push16(0x9999);
    mm.regs.hl = PTR;
    mem[CONFIG] = configBit; // bit0 gates the sub-state advance arm
    mem[GATE] = 0;
    mem[TEMPLATE_DST] = mem[TEMPLATE_SRC] ^ 0xff;
  });
}
const gateOn = () => seed(1);
const gateOff = () => seed(0);

function runOracle(entry) { const a = entry.clone(); a.routines = STUBS; oracle(a); return a; }

test("EQUAL (crafted): loc_04bc == oracle with the config gate armed", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, gateOn()), null, "loc_04bc diverged with the gate armed");
  const a = runOracle(gateOn());
  assert.equal(a.mem8[PTR_LO], 0x34, "positive control: oracle stored the pointer low byte");
  assert.equal(a.mem8[PTR_HI], 0x12, "positive control: oracle stored the pointer high byte");
  assert.equal(a.mem8[TEMPLATE_DST], a.mem8[TEMPLATE_SRC], "positive control: oracle blitted the template head");
  assert.equal(a.mem8[SEQ_STATE], 0, "positive control: oracle cleared the sequence state");
  assert.equal(a.mem8[GAME_STATE], 3, "positive control: oracle set the game state to 3");
  assert.equal(a.mem8[MODE_FLAG], 1, "positive control: oracle set the mode flag");
  assert.equal(a.mem8[SPAWN_FLAG], 1, "positive control: oracle set the spawn flag");
  assert.equal(a.mem8[GATE], 3, "positive control: config bit set -> oracle armed the gate");
  console.log("  EQUAL: loc_04bc == oracle (gate armed), pointer + template + state seeded");
});

test("EQUAL (crafted): loc_04bc == oracle with the config gate clear", { skip }, () => {
  // The 32-byte template blit lands on the gate cell before the conditional arm, so the cleared-config
  // value is the blitted template byte (not 0); ramDiff proves both sides agree, and the on/off gate
  // values differ because only the armed path forces 3.
  assert.equal(ramDiff(oracle, cand, gateOff()), null, "loc_04bc diverged with the gate clear");
  const a = runOracle(gateOff());
  assert.equal(a.mem8[GAME_STATE], 3, "positive control: oracle still seeded the state");
  assert.notEqual(a.mem8[GATE], runOracle(gateOn()).mem8[GATE], "positive control: config bit gates the arm");
  console.log("  EQUAL: loc_04bc == oracle (gate clear), gate not forced to the armed marker");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongPtr = (m) => { cand(m); m.mem8[PTR_LO] = (m.mem8[PTR_LO] + 1) & 0xff; };
  const wrongTemplate = (m) => { cand(m); m.mem8[TEMPLATE_DST] = m.mem8[TEMPLATE_DST] ^ 0xff; };
  const unArm = (m) => { cand(m); m.mem8[GATE] = 0; };                        // drops the arm (gate-on path)
  const wrongGate = (m) => { cand(m); m.mem8[GATE] = (m.mem8[GATE] + 1) & 0xff; }; // perturbs the gate cell
  assert.ok(ramDiff(oracle, noOp, gateOn()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongPtr, gateOn()), "wrong-pointer twin escaped");
  assert.ok(ramDiff(oracle, wrongTemplate, gateOn()), "perturbed-template twin escaped");
  assert.ok(ramDiff(oracle, unArm, gateOn()), "gate-dropping twin escaped");
  assert.ok(ramDiff(oracle, wrongGate, gateOff()), "gate-perturbing twin escaped");
  console.log("  TEETH: no-op, wrong-pointer, perturbed-template, drop-arm, perturbed-gate all caught");
});
