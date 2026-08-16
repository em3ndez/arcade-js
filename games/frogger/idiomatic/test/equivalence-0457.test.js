// SPDX-License-Identifier: GPL-3.0-only
/**
 * beginNextLifeOrIntro — memory-equivalent to the frozen oracle at ROM 0x0457.
 * GATE: crafted-entry. Redraws the score header, then if the life-restart gate 0x83ce==0 resumes at
 * the pace tail. Else re-activates the frog, clears the active player's work RAM, zeroes 0x839a/0x839b/
 * 0x83cc/0x83ea and the 14-byte HUD block 0x83a0-0x83ad, plays sound 0x80, then when 0x83cf!=0 runs the
 * intro entry 0x048f, else hands off and resumes. All sinks (0x0368) severed. Live-out memory-only; RAM
 * compared, stack masked. Teeth: no-op, a twin that leaves one HUD cell. Positive control: a seeded HUD
 * cell really goes 0xff->0 on the restart path.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff } from "./_spineSetup.js";
import { beginNextLifeOrIntro as cand } from "../beginNextLifeOrIntro.js";
import { loc_0457 as oracle } from "../../translated/loc_0457.js";
import { withOmittedRet } from "../../machine.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const LIFE = 0x83ce, INTRO = 0x83cf, TIMER = 0x83c5, HUD = 0x83a0, HUD5 = 0x83a5;

const noLife = () => craft((mem) => { mem[LIFE] = 0; });
const toIntro = () => craft((mem) => { mem[LIFE] = 1; mem[INTRO] = 1; mem[TIMER] = 2; mem[TIMER + 1] = 0; });
const toHandoff = () => craft((mem) => { mem[LIFE] = 1; mem[INTRO] = 0; mem[HUD5] = 0xff; });

test("EQUAL (crafted): beginNextLifeOrIntro == oracle on all three exits", { skip }, () => {
  for (const [name, mk] of [["no-life", noLife], ["restart->intro", toIntro], ["restart->handoff", toHandoff]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} exit diverged`);
  }
  const e = toHandoff(); const a = e.clone(); a.routines = e.routines; oracle(a);
  assert.equal(a.mem8[HUD5], 0, "positive control: restart path clears a HUD cell 0xff->0");
  console.log("  EQUAL: no-life/restart->intro/restart->handoff; control HUD 0xff->0");
});

test("TEETH: broken twins caught (on the restart->handoff path)", { skip }, () => {
  const noOp = () => {};
  const skipHud = (m) => { cand(m); m.mem8[HUD5] = 0xff; };
  const skipHudLo = (m) => { cand(m); m.mem8[HUD] = 0xff; };
  assert.ok(ramDiff(oracle, noOp, toHandoff()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, skipHud, craft((mem) => { mem[LIFE] = 1; mem[INTRO] = 0; mem[HUD5] = 0x33; })), "skip-hud twin escaped");
  assert.ok(ramDiff(oracle, skipHudLo, craft((mem) => { mem[LIFE] = 1; mem[INTRO] = 0; mem[HUD] = 0x33; })), "skip-hud-lo twin escaped");
  console.log("  TEETH: no-op, skip-hud, skip-hud-lo all caught");
});

test("SEAM: wireable — hands back the coroutine, SP never checked", { skip }, () => {
  for (const mk of [noLife, toIntro, toHandoff]) {
    const r = withOmittedRet(cand, 0x0457)(mk());
    assert.ok(r && typeof r.next === "function" && typeof r.throw === "function",
      "the seam must pass the coroutine handoff through as an iterator");
  }
  console.log("  SEAM: iterator handoff on all exits -> wireable");
});
