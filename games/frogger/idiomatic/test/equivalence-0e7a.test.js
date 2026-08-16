// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveAttractDemoSequencer — memory-equivalent to the frozen oracle at ROM 0x0e7a.
 * GATE: crafted-entry (spine dispatcher). Credits present (0x83e1!=0) tails to the attract-idle setter;
 * else a state machine on the phase byte 0x83bf: 0 seeds the demo + arms the animator, 1 runs the
 * scroll animator (computed jp(hl) picks the cell + floor, then the shared tail scrolls it -4px via the
 * still-translated frame clock 0x0f3e — a caller-skip), 2 rewinds the seven cells, >2 tails to the
 * per-cell demo stamp. Dissolves the moved-0 leaves; keeps m.call for the 0x0f3e caller-skip. Live-out
 * memory-only; RAM compared, stack masked. The 0x0f3e not-elapsed branch (phase1-skip) rets straight to
 * OUR caller: the SEAM sees the +2 it leaves and pc on the caller's slot, so it wires. Teeth: no-op,
 * wrong phase advance, wrong scroll. Positive control: phase 0 advances 0x83bf 0->1.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, SEAM_STUBS } from "./_spineDispatch.js";
import { driveAttractDemoSequencer as cand } from "../driveAttractDemoSequencer.js";
import { loc_0e7a as oracle } from "../../translated/loc_0e7a.js";
import { withOmittedRet } from "../../machine.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const CRED = 0x83e1, PHASE = 0x83bf, D7 = 0x83d7, FTMR = 0x83bd, CELL0 = 0x8040;

const credits = () => craft((mem) => { mem[CRED] = 1; });
const phase0 = () => craft((mem) => { mem[CRED] = 0; mem[PHASE] = 0; });
const phase1Skip = () => craft((mem) => { mem[CRED] = 0; mem[PHASE] = 1; mem[D7] = 7; mem[FTMR] = 5; });
const phase1Elapse = () => craft((mem) => { mem[CRED] = 0; mem[PHASE] = 1; mem[D7] = 7; mem[FTMR] = 1; });
const phase2 = () => craft((mem) => { mem[CRED] = 0; mem[PHASE] = 2; mem[D7] = 3; mem[FTMR] = 1; });
const phase3 = () => craft((mem) => { mem[CRED] = 0; mem[PHASE] = 3; });

test("EQUAL (crafted): driveAttractDemoSequencer == oracle on credits + every phase", { skip }, () => {
  for (const [name, mk] of [["credits", credits], ["phase0", phase0], ["phase1-skip", phase1Skip],
                            ["phase1-elapse", phase1Elapse], ["phase2", phase2], ["phase3", phase3]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} branch diverged`);
  }
  const e = phase0(); const before = e.mem8[PHASE]; const a = e.clone(); oracle(a);
  assert.equal(before, 0, "positive control seed: 0x83bf starts at 0");
  assert.equal(a.mem8[PHASE], 1, "positive control: phase 0 advances the phase byte 0x83bf 0->1");
  console.log("  EQUAL: credits/phase0/phase1-skip/phase1-elapse/phase2/phase3; control 0x83bf 0->1");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongPhase = (m) => { cand(m); m.mem8[PHASE] = 0; };
  const wrongScroll = (m) => { cand(m); m.mem8[CELL0] = (m.mem8[CELL0] + 1) & 0xff; };
  assert.ok(ramDiff(oracle, noOp, phase0()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongPhase, phase0()), "wrong-phase twin escaped");
  assert.ok(ramDiff(oracle, wrongScroll, phase1Elapse()), "wrong-scroll twin escaped");
  console.log("  TEETH: no-op, wrong-phase, wrong-scroll all caught");
});

test("SEAM: wireable — delta-0/+2 return incl. the 0x0f3e caller-skip", { skip }, () => {
  const isIter = (r) => r && typeof r.next === "function" && typeof r.throw === "function";
  for (const [name, mk] of [
    ["credits", () => craft((mem) => { mem[CRED] = 1; }, SEAM_STUBS)],
    ["phase0", () => craft((mem) => { mem[CRED] = 0; mem[PHASE] = 0; }, SEAM_STUBS)],
    ["phase1-skip", () => craft((mem) => { mem[CRED] = 0; mem[PHASE] = 1; mem[D7] = 7; mem[FTMR] = 5; }, SEAM_STUBS)],
    ["phase1-elapse", () => craft((mem) => { mem[CRED] = 0; mem[PHASE] = 1; mem[D7] = 7; mem[FTMR] = 1; }, SEAM_STUBS)],
    ["phase2", () => craft((mem) => { mem[CRED] = 0; mem[PHASE] = 2; mem[D7] = 3; mem[FTMR] = 1; }, SEAM_STUBS)],
    ["phase3", () => craft((mem) => { mem[CRED] = 0; mem[PHASE] = 3; }, SEAM_STUBS)],
  ]) {
    const r = withOmittedRet(cand, 0x0e7a)(mk());
    assert.ok(!isIter(r), `the ${name} branch must not hand back a coroutine`);
  }
  console.log("  SEAM: no throw on credits/phase0/phase1-skip/phase1-elapse/phase2/phase3 -> wireable");
});
