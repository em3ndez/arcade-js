// SPDX-License-Identifier: GPL-3.0-only
/**
 * scanFrogInputAndDispatchHop — memory-equivalent to the frozen oracle at ROM 0x1ACB.
 * A coherent post-boot state (captured at 0x0b1f, frog cursors armed) is cloned and the gate/timer/hold
 * cells, hop lane flags, and joystick ports poked to drive each path; the oracle reaches the hop handlers
 * + slot cursor via m.call, the rewrite calls the lifted ones directly. RAM compared, dead stack masked.
 * The crafted names and assert messages below say which branch each case drives; teeth mutate the
 * candidate and a positive control proves the idle clear is non-vacuous.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  romsPresent, craft, ramDiff,
  FROG_X, FROG_Y, FROG_SPRITE, ACTIVE, ARRIVAL, COUNTER, RELOAD, VDELTA, HDELTA,
} from "./_frogHop.js";
import {
  GATED_COUNTDOWN_ENABLE_FLAG, FROG_HOP_INPUT_TIMER, HOLD_FLAG, ACTIVE_PLAYER, HOME_BAY_SLOT_CURSOR,
} from "../names.js";
import { scanFrogInputAndDispatchHop as cand } from "../scanFrogInputAndDispatchHop.js";
import { advanceFrogHopUp } from "../animateFrogHop.js";
import { loc_1acb as oracle } from "../../translated/loc_1acb.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const IDLE_IN0 = 0xff, IDLE_IN1 = 0xfc, IDLE_IN2 = 0xf1;
const GATE = GATED_COUNTDOWN_ENABLE_FLAG, TIMER = FROG_HOP_INPUT_TIMER, HOLD = HOLD_FLAG, PLAYER = ACTIVE_PLAYER;

// A clean unlocked main-body state: gates open, player 1, idle sticks, all lane flags clear and the
// arrival/counter cells pre-dirtied to 0xff so any clear the scan performs is observable.
function base(mem, m) {
  mem[GATE] = 0; mem[TIMER] = 0; mem[HOLD] = 0; mem[PLAYER] = 1;
  m.io.in0 = IDLE_IN0; m.io.in1 = IDLE_IN1; m.io.in2 = IDLE_IN2;
  for (let i = 0; i < 4; i++) { mem[ACTIVE[i]] = 0; mem[ARRIVAL[i]] = 0xff; mem[COUNTER[i]] = 0xff; }
}

const gate = () => craft((mem, m) => { base(mem, m); mem[GATE] = 1; });
const held = () => craft((mem, m) => { base(mem, m); mem[HOLD] = 1; });
const timer = () => craft((mem, m) => { base(mem, m); mem[TIMER] = 5; mem[HOME_BAY_SLOT_CURSOR] = 2; });
const idle = () => craft((mem, m) => { base(mem, m); mem[FROG_X] = 0x80; mem[FROG_Y] = 0x80; });

// A DOWN hop in progress: the scan tail-dispatches the DOWN advance and returns.
const advanceDown = () => craft((mem, m) => {
  base(mem, m);
  mem[ACTIVE[0]] = 1; mem[ARRIVAL[0]] = 0; mem[COUNTER[0]] = 2; mem[VDELTA] = 3;
  mem[FROG_Y] = 0x50; mem[FROG_SPRITE] = 0x00;
});

// A fresh UP press on player 1 (IN2 bit 4 cleared): the scan clears DOWN, then begins the UP hop.
const beginUpP1 = () => craft((mem, m) => {
  base(mem, m); m.io.in2 = IDLE_IN2 & ~0x10;
  mem[ARRIVAL[1]] = 0; mem[COUNTER[1]] = 0; mem[RELOAD[1]] = 9; mem[VDELTA] = 2;
  mem[FROG_Y] = 0x80; mem[FROG_SPRITE] = 0x00; mem[HOME_BAY_SLOT_CURSOR] = 2;
});

// A fresh RIGHT press on player 1 (IN0 bit 4 = register-C bit 4 cleared): clears DOWN + UP, begins RIGHT.
const beginRightP1 = () => craft((mem, m) => {
  base(mem, m); m.io.in0 = IDLE_IN0 & ~0x10;
  mem[ARRIVAL[2]] = 0; mem[COUNTER[2]] = 0; mem[RELOAD[2]] = 9; mem[HDELTA] = 2;
  mem[FROG_X] = 0x80; mem[FROG_Y] = 0x80; mem[FROG_SPRITE] = 0x00;
});

// Player 2 (cocktail bit set, ACTIVE_PLAYER=2): a fresh UP press routes to IN0 bit 0, not P1's IN2 bit 4.
const beginUpP2 = () => craft((mem, m) => {
  base(mem, m); mem[PLAYER] = 2; m.io.in2 = IDLE_IN2 | 0x08; m.io.in0 = IDLE_IN0 & ~0x01;
  mem[ARRIVAL[1]] = 0; mem[COUNTER[1]] = 0; mem[RELOAD[1]] = 9; mem[VDELTA] = 2;
  mem[FROG_Y] = 0x80; mem[FROG_SPRITE] = 0x00; mem[HOME_BAY_SLOT_CURSOR] = 2;
});

// RIGHT active + idle sticks: UP-begin is skipped ((RIGHT|LEFT)_ACTIVE != 0), UP flags stay, RIGHT advances.
const skipUpRightActive = () => craft((mem, m) => {
  base(mem, m);
  mem[ACTIVE[2]] = 1; mem[ARRIVAL[2]] = 0; mem[COUNTER[2]] = 2; mem[HDELTA] = 2;
  mem[FROG_X] = 0x80; mem[FROG_Y] = 0x80; mem[FROG_SPRITE] = 0x00;
});

test("EQUAL (crafted): scanFrogInputAndDispatchHop == oracle across gate/timer/hold/idle/dispatch/2P", { skip }, () => {
  for (const [name, mk] of [
    ["gate", gate], ["hold", held], ["timer", timer], ["idle", idle],
    ["advance-DOWN", advanceDown], ["begin-UP-P1", beginUpP1], ["begin-RIGHT-P1", beginRightP1],
    ["begin-UP-P2", beginUpP2], ["skip-up-right-active", skipUpRightActive],
  ]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} path diverged`);
  }
  // Non-vacuity: the oracle actually writes memory on the paths whose EQUAL would otherwise be hollow.
  const noOp = () => {};
  assert.ok(ramDiff(oracle, noOp, idle()), "vacuous: oracle wrote nothing on the idle clear path");
  assert.ok(ramDiff(oracle, noOp, timer()), "vacuous: oracle wrote nothing on the timer path");
  assert.ok(ramDiff(oracle, noOp, advanceDown()), "vacuous: oracle wrote nothing on the DOWN advance");
  assert.ok(ramDiff(oracle, noOp, skipUpRightActive()), "vacuous: oracle wrote nothing on the UP-skip/RIGHT-advance");
  console.log("  EQUAL: gate/hold/timer/idle-clear + DOWN-advance/UP-begin/RIGHT-begin + P2 UP routing");
});

test("POSITIVE CONTROL: the idle clear moves a real flag (0xff -> 0)", { skip }, () => {
  const e = idle(); const before = e.mem8[ARRIVAL[0]]; const a = e.clone(); oracle(a);
  assert.equal(before, 0xff, "setup: DOWN arrival was not pre-dirtied");
  assert.equal(a.mem8[ARRIVAL[0]], 0, "idle clear never cleared DOWN arrival — the case is vacuous");
  console.log(`  POSITIVE CONTROL: DOWN arrival ${before}->${a.mem8[ARRIVAL[0]]} on the idle path`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const skipClearDown = (m) => { cand(m); m.mem8[ARRIVAL[0]] = 0xff; }; // leaves DOWN's arrival dirty
  const wrongDirection = (m) => advanceFrogHopUp(m);                    // UP advance where DOWN was due
  const failToSkipUp = (m) => { cand(m); m.mem8[ARRIVAL[1]] = 0; m.mem8[COUNTER[1]] = 0; }; // clears UP the skip must leave
  assert.ok(ramDiff(oracle, noOp, idle()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, skipClearDown, idle()), "skip-clear-DOWN twin escaped");
  assert.ok(ramDiff(oracle, wrongDirection, advanceDown()), "wrong-direction twin escaped");
  assert.ok(ramDiff(oracle, failToSkipUp, skipUpRightActive()), "fail-to-skip-UP twin escaped");
  console.log("  TEETH: no-op, skip-clear-DOWN, wrong-direction, fail-to-skip-UP all caught");
});
