// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1d43 — memory-equivalent to the frozen oracle at ROM 0x1d43.
 * Stamps `count` two-tile pairs from the VRAM cursor (register HL), saves the advanced cursor to 0x400b,
 * then ticks the strip-redraw countdown 0x4008; while it is still running it returns, else it restarts the
 * screen-fill outer dwell. The oracle reaches the counter via `exx`, so the seed also lays the ALTERNATE
 * bank HL = 0x4008 (h'/l'); the candidate uses the named cell directly. Two paths:
 *   RUN: countdown > 1 -> stamp + save cursor + decrement, no cascade.
 *   EXPIRE: countdown == 1 -> after the tick the outer dwell tier (0x4009) is ticked instead.
 * EQUAL asserts ramDiff==null on both (return-stack masked). Teeth: no-op, wrong-count, wrong-cursor,
 * and a skip-decrement twin.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { drawScreenFillStripSecondHalf as cand } from "../drawScreenFillStripSecondHalf.js";
import { loc_1d43 as oracle } from "../../translated/loc_1d43.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const CURSOR = 0x5100;   // VRAM write cursor (active bank HL)
const COUNT = 16;        // pairs to stamp (entry contract B=0x10)
const DWELL = 0x4008;    // strip-redraw countdown (restored past the bank swap)
const DWELL_TIER = 0x4009;
const TILE_A = 52;       // 0x34
const CURSOR_END = CURSOR + COUNT * 2;

// Seat the active bank (cursor + count) and the alternate bank (HL' = the dwell-timer pointer).
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

const runEntry = () => seed((mem8) => { mem8[DWELL] = 5; });     // dec -> 4, still running
const expireEntry = () => seed((mem8) => { mem8[DWELL] = 1; mem8[DWELL_TIER] = 3; }); // dec -> 0, cascade

test("EQUAL (crafted): loc_1d43 == oracle stamps the strip and ticks the countdown", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, runEntry()), null, "loc_1d43 diverged on the run path");
  const a = runEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[CURSOR], TILE_A, "positive control: oracle stamped the first strip tile");
  assert.equal(a.mem.read16(0x400b), CURSOR_END, "positive control: oracle saved the advanced cursor");
  assert.equal(a.mem8[DWELL], 4, "positive control: oracle decremented the countdown");
  console.log("  EQUAL: loc_1d43 == oracle, strip stamped + countdown 5->4");
});

test("EQUAL (crafted): loc_1d43 == oracle cascades to the outer dwell on expiry", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, expireEntry()), null, "loc_1d43 diverged on the expire path");
  const a = expireEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[DWELL], 0, "positive control: countdown hit zero");
  assert.equal(a.mem8[DWELL_TIER], 2, "positive control: the outer dwell tier was ticked");
  console.log("  EQUAL: loc_1d43 == oracle, countdown expiry ticks the outer dwell tier");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongCount = (m) => { m.regs.b = COUNT + 1; cand(m); };
  const wrongCursor = (m) => { m.regs.hl = CURSOR + 2; cand(m); };
  const skipDec = (m) => { cand(m); m.mem8[DWELL] = m.mem8[DWELL] + 1; };
  assert.ok(ramDiff(oracle, noOp, runEntry()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongCount, runEntry()), "wrong-count twin escaped");
  assert.ok(ramDiff(oracle, wrongCursor, runEntry()), "wrong-cursor twin escaped");
  assert.ok(ramDiff(oracle, skipDec, runEntry()), "skip-decrement twin escaped");
  console.log("  TEETH: no-op, wrong-count, wrong-cursor, skip-decrement all caught");
});
