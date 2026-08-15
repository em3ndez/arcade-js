// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderMode2IntroScreen — memory-equivalent to the frozen oracle at ROM 0x2D88.
 * GATE: crafted-entry. Attract never dispatches this mode-2 intro within ENTRY_FRAMES (probe: 0), so
 * a post-boot attract machine is cloned and the shared time byte (0x83E4) poked to drive both exits:
 * >=10 returns after the field fill and first title strip; <10 draws a digit and three more strips.
 * The fill (0x0766), the strip blits (rst 0x28) and the digit draw (0x0BA9) run on each side's own
 * clone, so their VRAM/tilemap writes are the compared live-out. Live-out is memory-only; registers
 * and SP are not compared. The rewrite dissolves those calls to direct JS calls, so it no longer
 * mirrors the oracle's return-address pushes: the oracle leaves a stale return address in the top
 * stack bytes and the rewrite does not, dead scratch that is not live-out, so [SP-8, SP) is masked
 * before the RAM compare. Teeth: three broken twins, each diverging in VRAM/counters outside the mask.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { renderMode2IntroScreen } from "../renderMode2IntroScreen.js";
import { loc_2d88 as oracle } from "../../translated/loc_2d88.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const TIME_BYTE = 0x83e4;
const SEED_CELL = 0x802b; // one of the counters the intro seeds
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

function entryWithTime(t) {
  const e = seedMachine().clone();
  e.mem8[TIME_BYTE] = t;
  return e;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
const WORK_RAM_BASE = 0x8000;
const WORK_RAM_END = 0x8800;
// Zero the dead stack scratch [SP-8, SP) (clamped to work RAM): the oracle's push/ret plumbing writes
// a return address there that the dissolved rewrite never does, and it is not live-out.
function maskStack(dump, sp) {
  const lo = Math.max(WORK_RAM_BASE, sp - 8);
  const hi = Math.min(WORK_RAM_END, sp);
  for (let a = lo; a < hi; a++) dump[a - WORK_RAM_BASE] = 0;
  return dump;
}
function ramDiff(cand, machine) {
  const sp = machine.regs.sp; // entry SP; both sides' stack activity sits just below it
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(
    maskStack(a.dumpState(), sp),
    maskStack(b.dumpState(), sp),
    (o) => a.stateOffsetToAddr(o),
  );
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// broken twins.
function brokenNoOp() {}
function brokenWrongSeed(m) { oracle(m); m.mem8[SEED_CELL] = 99; } // BUG: corrupt a seeded counter after the fact
function brokenDropLastStrip(m) {
  const { regs, mem8 } = m;
  mem8[0x83d8] = 0xff; m.push16(0x2d90); m.call(0x0766);
  mem8[0x829b] = 0; mem8[0x8021] = 0; mem8[0x801b] = 5; mem8[0x802b] = 3;
  regs.de = 0x2f5c; regs.hl = 0xaa8d; regs.b = 11; m.push16(0x2daa); m.call(0x0028);
  if (mem8[TIME_BYTE] >= 10) return;
  regs.a = mem8[TIME_BYTE]; regs.hl = 0xab15; m.push16(0x2db6); m.call(0x0ba9);
  regs.de = 0x2fae; regs.b = 7; m.push16(0x2dbc); m.call(0x0028);
  regs.de = 0x2f73; regs.b = 4; m.push16(0x2dc2); m.call(0x0028); // BUG: never blits the 4th strip
}

test("EQUAL (crafted): renderMode2IntroScreen == oracle on both time-byte exits", { skip }, () => {
  const splash = entryWithTime(20);
  const full = entryWithTime(3);
  assert.equal(ramDiff(renderMode2IntroScreen, splash), null, "the splash (time>=10) exit diverged");
  assert.equal(ramDiff(renderMode2IntroScreen, full), null, "the full (time<10) exit diverged");
  // non-vacuous: the intro actually writes RAM/VRAM.
  assert.ok(ramDiff(brokenNoOp, full), "vacuous: oracle wrote nothing");
  console.log("  EQUAL: splash + full exits, renderMode2IntroScreen == oracle");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const full = entryWithTime(3);
  assert.ok(ramDiff(brokenNoOp, full), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongSeed, full), "the wrong-seed twin escaped");
  assert.ok(ramDiff(brokenDropLastStrip, full), "the dropped-strip twin escaped");
  console.log("  TEETH: no-op, wrong-seed, dropped-strip all caught");
});
