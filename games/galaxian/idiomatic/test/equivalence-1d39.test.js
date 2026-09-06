// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1d39 — memory-equivalent to the frozen oracle at ROM 0x1d39.
 * First half of the tile-strip fill: stamps `count` two-tile pairs (30,32) from the VRAM cursor (HL)
 * forward, two cells per pass, then hands the advanced cursor to the second half, which stamps a fixed 16
 * pairs (34,36), saves the cursor to 0x400b, and ticks the strip countdown 0x4008. The oracle reaches the
 * countdown through `exx`, so the seed also lays the ALTERNATE bank HL' = 0x4008 (the idiomatic second half
 * uses the named cell directly). All live-outs are VRAM + 0x400b + 0x4008 in the state dump, so EQUAL is
 * asserted on ramDiff==null (return-stack masked). Teeth: no-op, a wrong-first-tile twin, a wrong-count
 * twin (first half stamps the wrong span), and a skip-first-half twin.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { drawScreenFillStripFirstHalf as cand } from "../drawScreenFillStripFirstHalf.js";
import { loc_1d39 as oracle } from "../../translated/loc_1d39.js";
import { drawScreenFillStripSecondHalf } from "../drawScreenFillStripSecondHalf.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const CURSOR = 0x5100;   // VRAM write cursor (main HL)
const COUNT = 16;        // first-half pairs (entry contract B=0x10)
const DWELL = 0x4008;    // strip countdown, restored past the bank swap
const FIRST_A = 48, FIRST_B = 50;   // 0x30, 0x32
const SECOND_A = 52, SECOND_B = 54; // 0x34, 0x36
const SECOND_START = CURSOR + COUNT * 2;
const CURSOR_END = SECOND_START + COUNT * 2;

// Seat the active bank (cursor + count) and the alternate bank (HL' = the countdown pointer, via exx).
function seed(mut) {
  return craft((mem8, mm) => {
    mm.push16(0x9999);
    mm.regs.hl = CURSOR;
    mm.regs.b = COUNT;
    mm.regs.h_ = 0x40; // exx restores main HL = 0x4008
    mm.regs.l_ = 0x08;
    mut(mem8, mm);
  });
}
const runEntry = () => seed((mem8) => { mem8[DWELL] = 5; }); // dec -> 4, still running

test("EQUAL (crafted): loc_1d39 == oracle stamps both strip halves and ticks the countdown", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, runEntry()), null, "loc_1d39 diverged on the strip fill");
  const a = runEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[CURSOR], FIRST_A, "positive control: first-half tile A not stamped");
  assert.equal(a.mem8[CURSOR + 1], FIRST_B, "positive control: first-half tile B not stamped");
  assert.equal(a.mem8[SECOND_START], SECOND_A, "positive control: second-half tile A not stamped");
  assert.equal(a.mem8[SECOND_START + 1], SECOND_B, "positive control: second-half tile B not stamped");
  assert.equal(a.mem.read16(0x400b), CURSOR_END, "positive control: advanced cursor not saved");
  assert.equal(a.mem8[DWELL], 4, "positive control: countdown not decremented");
  console.log("  EQUAL: loc_1d39 == oracle, both halves stamped + countdown 5->4");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongFirstTile = (m) => { cand(m); m.mem8[CURSOR] = 0; };
  const wrongCount = (m) => { m.regs.b = COUNT + 1; cand(m); };
  const skipFirstHalf = (m) => { drawScreenFillStripSecondHalf(m, m.regs.hl, COUNT); };
  assert.ok(ramDiff(oracle, noOp, runEntry()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongFirstTile, runEntry()), "wrong-first-tile twin escaped");
  assert.ok(ramDiff(oracle, wrongCount, runEntry()), "wrong-count twin escaped");
  assert.ok(ramDiff(oracle, skipFirstHalf, runEntry()), "skip-first-half twin escaped");
  console.log("  TEETH: no-op, wrong-first-tile, wrong-count, skip-first-half all caught");
});
