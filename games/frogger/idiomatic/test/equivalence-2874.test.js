// SPDX-License-Identifier: GPL-3.0-only
/**
 * armDiveHighPhase — memory-equivalent to the frozen oracle at ROM 0x2874 (the level>=5 dive arm). When
 * the figure phase 0x8101 is idle it runs the one-shot frame arm (armTwoPairFigureFrame); either way it
 * continues into the shared surface-timer step (0x27FE). GATE: crafted-entry. States: phase-idle (arms,
 * then odd-phase copy), phase-idle-but-busy (arm self-guards, counter step), and phase-set (arm skipped,
 * even-phase copy). RAM compared, stack masked. Teeth: no-op, a skip-arm twin, and a skip-surface-step
 * twin; positive controls assert the seed/gate from the arm and the frame copy from the surface step.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, STUBS } from "./_bootSetup.js";
import { armDiveHighPhase as cand } from "../armDiveHighPhase.js";
import { armTwoPairFigureFrame } from "../armTwoPairFigureFrame.js";
import { stepDiveSurfaceTimer } from "../stepDiveSurfaceTimer.js";
import { loc_2874 as oracle } from "../../translated/loc_287e.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const PHASE = 0x8101, BUSY = 0x814f, GATE = 0x8150, BUF = 0x819b, C6 = 0x8146, C7 = 0x8147;
const FRAME_IDX = 0x814e, COLUMN = 0x8145, VRAM = 0xa806;

const phaseIdle = () => craft((mem) => { mem[PHASE] = 0; mem[BUSY] = 0; mem[BUF] = 0x33; mem[GATE] = 0; mem[C6] = 0; mem[C7] = 0; mem[FRAME_IDX] = 0; mem[COLUMN] = 0; mem[VRAM] = 0; mem[VRAM + 1] = 0; });
const phaseIdleBusy = () => craft((mem) => { mem[PHASE] = 0; mem[BUSY] = 1; mem[C6] = 0x30; mem[C7] = 0x31; mem[FRAME_IDX] = 0x07; });
const phaseSet = () => craft((mem) => { mem[PHASE] = 1; mem[BUSY] = 1; mem[C6] = 0x20; mem[C7] = 0x20; mem[GATE] = 0x02; mem[FRAME_IDX] = 0; mem[COLUMN] = 0; mem[VRAM] = 0; mem[VRAM + 1] = 0; });

test("EQUAL (crafted): armDiveHighPhase == oracle across phase-idle/idle-busy/phase-set", { skip }, () => {
  for (const [name, mk] of [["phase-idle", phaseIdle], ["phase-idle-busy", phaseIdleBusy], ["phase-set", phaseSet]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} path diverged`);
  }
  // phase-idle: arm seeds gate=1 and cells=(0x33&0x0f)*8=0x18, then the odd-phase surface step copies the
  // main table and decrements 0x8147 (0x18 -> 0x17).
  let a = phaseIdle(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[GATE], 1, "control: arm raised the step gate");
  assert.equal(a.mem8[BUSY], 1, "control: arm raised the busy latch");
  assert.equal(a.mem8[C6], 0x18, "control: arm seeded 0x8146 = (0x33 & 0x0f)*8");
  assert.equal(a.mem8[C7], 0x17, "control: seed 0x18 then surface step decremented -> 0x17");
  assert.equal(a.mem8[VRAM], 0x10, "control: odd-phase surface step copies the main table 0x1413");
  // phase-set: arm skipped (gate stays 0x02), even-phase surface step copies the alternate table.
  a = phaseSet(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[GATE], 0x02, "control: arm skipped when the figure phase is set (gate unchanged)");
  assert.equal(a.mem8[VRAM], 0x5c, "control: even-phase surface step copies the alternate table 0x1403");
  assert.equal(a.mem8[C7], 0x1f, "control: surface step decremented 0x8147 (0x20->0x1f)");
  console.log("  EQUAL: phase-idle/idle-busy/phase-set; controls arm-seed + surface-copy asserted");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const skipArm = (m) => stepDiveSurfaceTimer(m); // never arms
  const skipStep = (m) => { if (m.mem8[PHASE] === 0) armTwoPairFigureFrame(m); }; // never steps the surface timer
  assert.ok(ramDiff(oracle, noOp, phaseIdle()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, skipArm, phaseIdle()), "skip-arm twin escaped");
  assert.ok(ramDiff(oracle, skipStep, phaseIdle()), "skip-surface-step twin escaped");
  console.log("  TEETH: no-op, skip-arm, skip-surface-step all caught");
});
