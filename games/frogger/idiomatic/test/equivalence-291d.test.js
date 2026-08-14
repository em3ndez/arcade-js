// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_291d — memory-equivalent to the frozen oracle at ROM 0x291D.
 * GATE: crafted-entry. Attract never dispatches this figure-animation step (probe: 0 dispatches over
 * ENTRY_FRAMES), so a post-boot attract machine is cloned and its four gate cells poked to drive each
 * path: the idle clear, the two early-out guards, the plain phase bump, and the two blit phases (64
 * and 112, the latter restarting the phase). The blit targets are pre-dirtied so writes are
 * observable. The one caller immediately makes another call, so no register the routine leaves is
 * read: LIVE-OUT is memory-only and registers/SP are not compared. No push/pop, so no dead stack
 * scratch. Teeth: four broken twins the RAM diff catches, spanning the blit, the busy guard, and the
 * phase reset.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_291d } from "../loc_291d.js";
import { loc_291d as oracle } from "../../translated/loc_291d.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ACTIVE = 0x8101; // idle when 0
const GATE = 0x8150; // bit0 arms the step
const BUSY = 0x814f; // non-zero blocks the step
const PHASE = 0x833f;
const FIG = 0xa846; // first tile cell; second pair one row (+32) below
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let seed = null;
function seedMachine() {
  if (seed) return seed;
  const m = makeMachine();
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the seed run stopped early: ${m.stoppedBy}`);
  seed = m.clone();
  return seed;
}

// A post-boot machine with the four gate cells poked and the blit targets dirtied.
function craft({ active, arm, busy, phase }) {
  const e = seedMachine().clone();
  e.mem8[ACTIVE] = active;
  e.mem8[GATE] = arm ? 1 : 0;
  e.mem8[BUSY] = busy;
  e.mem8[PHASE] = phase;
  for (const off of [0, 1, 32, 33]) e.mem8[(FIG + off) & 0xffff] = 0xee;
  return e;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

const PATHS = [
  ["idle clear", { active: 0, arm: 1, busy: 0, phase: 0x10 }],
  ["arm clear -> early out", { active: 1, arm: 0, busy: 0, phase: 0x10 }],
  ["busy -> early out", { active: 1, arm: 1, busy: 5, phase: 0x10 }],
  ["plain bump", { active: 1, arm: 1, busy: 0, phase: 0x10 }],
  ["blit A (phase 64)", { active: 1, arm: 1, busy: 0, phase: 0x3f }],
  ["blit B + reset (phase 112)", { active: 1, arm: 1, busy: 0, phase: 0x6f }],
  ["bump wraps 255 -> 0", { active: 1, arm: 1, busy: 0, phase: 0xff }],
];

function brokenNoOp() {}
function step(m, blitA, blitB, honorBusy, reset) {
  const { mem8 } = m;
  if (mem8[ACTIVE] === 0) { mem8[PHASE] = 0; return; }
  if ((mem8[GATE] & 1) === 0) return;
  if (honorBusy && mem8[BUSY] !== 0) return;
  const p = (mem8[PHASE] + 1) & 0xff;
  mem8[PHASE] = p;
  const put = (t) => { mem8[FIG] = t; mem8[(FIG + 1) & 0xffff] = t + 1; mem8[(FIG + 32) & 0xffff] = t + 2; mem8[(FIG + 33) & 0xffff] = t + 3; };
  if (p === 64) put(blitA);
  else if (p === 112) { put(blitB); if (reset) mem8[PHASE] = 0; }
}
const brokenWrongTile = (m) => step(m, 99, 208, true, true); // wrong frame-A tiles
const brokenNoBusyGuard = (m) => step(m, 104, 208, false, true); // ignores the busy guard
const brokenNoReset = (m) => step(m, 104, 208, true, false); // blit B forgets to restart the phase

test("EQUAL (crafted): loc_291d == oracle on every path", { skip }, () => {
  const entries = PATHS.map(([, cfg]) => craft(cfg));
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (let i = 0; i < entries.length; i++) assert.equal(ramDiff(loc_291d, entries[i]), null, `diverged: ${PATHS[i][0]}`);
  assert.ok(ramDiff(brokenNoOp, craft(PATHS[0][1])), "vacuous: oracle wrote nothing on the idle path");
  console.log(`  EQUAL: ${entries.length} crafted paths, loc_291d == oracle`);
});

test("TEETH: broken twins are caught across blit, busy guard, and reset", { skip }, () => {
  assert.ok(ramDiff(brokenNoOp, craft(PATHS[0][1])), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongTile, craft(PATHS[4][1])), "the wrong-tile twin escaped");
  assert.ok(ramDiff(brokenNoBusyGuard, craft(PATHS[2][1])), "the no-busy-guard twin escaped");
  assert.ok(ramDiff(brokenNoReset, craft(PATHS[5][1])), "the no-reset twin escaped");
  console.log("  TEETH: no-op, wrong-tile, no-busy-guard, no-reset all caught");
});
