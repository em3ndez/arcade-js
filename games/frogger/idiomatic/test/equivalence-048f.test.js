// SPDX-License-Identifier: GPL-3.0-only
/**
 * runIntroTimerThenInitGame — memory-equivalent to the frozen oracle at ROM 0x048F.
 * GATE: crafted-entry. Redraws the game-over line, plays two jingles, spins the 16-bit intro timer
 * 0x83c5 to 0, then dispatches by configuration: one-player (0x83fe==1) -> cold-start 0x0547; a
 * non-player-1 turn (0x83fd!=1) -> player-2 continue 0x04f3; else 0x83c9=1 and, when 0x83ca!=0, the
 * player-1 pre-clear; otherwise the fresh player-1 seed (clear tilemap, hand off, 0x83fe/0x825c=1,
 * clear 0x825e gates, copy work 0x8600->0x80ff and object 0x85c0->0x800c pages, 0x803f=1) then the
 * pace tail. All sinks (0x0368/0x0567) severed. Live-out memory-only; RAM compared, stack masked.
 * Teeth: no-op, wrong slot byte, a skipped gate. Positive control: the intro timer really reaches 0.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff } from "./_spineSetup.js";
import { runIntroTimerThenInitGame as cand } from "../runIntroTimerThenInitGame.js";
import { loc_048f as oracle } from "../../translated/loc_048f.js";
import { withOmittedRet } from "../../machine.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const TIMER = 0x83c5, PLAYERS = 0x83fe, CURPLAYER = 0x83fd;
const CONT2 = 0x83ca, SLOT1 = 0x825c, GATE0 = 0x825e;

// A small intro-timer count keeps the drain loop short; both sides drain it to 0 identically.
const timer = (mem) => { mem[TIMER] = 3; mem[TIMER + 1] = 0; };
const onePlayer = () => craft((mem) => { timer(mem); mem[PLAYERS] = 1; });
const nonP1 = () => craft((mem) => { timer(mem); mem[PLAYERS] = 2; mem[CURPLAYER] = 2; });
const p1PreClear = () => craft((mem) => { timer(mem); mem[PLAYERS] = 2; mem[CURPLAYER] = 1; mem[CONT2] = 5; });
const p1Fresh = () => craft((mem) => { timer(mem); mem[PLAYERS] = 2; mem[CURPLAYER] = 1; mem[CONT2] = 0; mem[SLOT1] = 0; mem[GATE0] = 0x22; });

test("EQUAL (crafted): runIntroTimerThenInitGame == oracle on all four branches", { skip }, () => {
  for (const [name, mk] of [["1P", onePlayer], ["non-P1", nonP1], ["P1-preclear", p1PreClear], ["P1-fresh", p1Fresh]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} branch diverged`);
  }
  const e = p1Fresh(); const a = e.clone(); a.routines = e.routines; oracle(a);
  assert.equal(a.mem8[TIMER], 0, "positive control: intro timer drained to 0");
  assert.equal(a.mem8[SLOT1], 1, "positive control: fresh path sets the slot byte 0->1");
  console.log("  EQUAL: 1P/non-P1/P1-preclear/P1-fresh; control timer->0, slot->1");
});

test("TEETH: broken twins caught (on the fresh P1 seed)", { skip }, () => {
  const noOp = () => {};
  const wrongSlot = (m) => { cand(m); m.mem8[SLOT1] = 0x77; };
  const skipGate = (m) => { cand(m); m.mem8[GATE0] = 0x22; };
  assert.ok(ramDiff(oracle, noOp, p1Fresh()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongSlot, p1Fresh()), "wrong-slot twin escaped");
  assert.ok(ramDiff(oracle, skipGate, p1Fresh()), "skip-gate twin escaped");
  console.log("  TEETH: no-op, wrong-slot, skip-gate all caught");
});

test("SEAM: wireable — hands back the coroutine, SP never checked", { skip }, () => {
  for (const mk of [onePlayer, nonP1, p1PreClear, p1Fresh]) {
    const r = withOmittedRet(cand, 0x048f)(mk());
    assert.ok(r && typeof r.next === "function" && typeof r.throw === "function",
      "the seam must pass the coroutine handoff through as an iterator");
  }
  console.log("  SEAM: iterator handoff on all exits -> wireable");
});
