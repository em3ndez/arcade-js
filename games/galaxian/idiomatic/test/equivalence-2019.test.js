// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2019 (absorbs loc_202c) — crafted-entry equivalence vs the frozen slot-decode + jp(hl) dispatcher.
 * Register live-in is A (control byte; low nibble -> handler index) and HL (0x40:slot pointer). The routine
 * retires both slot bytes to 0xff, advances the read cursor (wrapping to the list base 0xc0 when it drops
 * below), stores the advanced cursor to DISPLAY_LIST_CURSOR (0x40a1), then hands the slot's second byte (the
 * handler argument) to one of the 8 draw handlers named by the absorbed word table at 0x203d. No caller reads
 * a register back (the frozen dispatch loop at 0x200a re-reads 0x40a1 from memory), so RAM equivalence is the
 * whole story: EQUAL asserts ramDiff==null on every even handler index, each crafted non-vacuously.
 * Teeth: a no-op, a dispatch-only (no decode), a decode-only (no dispatch), a skip-first-byte-retire, and a
 * mis-dispatch twin each diverge, proving both slot retires, the cursor store, and the selector are all
 * load-bearing; a WRAP arm proves the below-0xc0 wrap. The SP-seam tooth proves the absorbed `push 0x200a; jp (hl)` dispatch is stack-neutral
 * (no return word pushed) on every arm and refuses a stack-adrift mutant. The return-stack window is masked
 * by ramDiff. Indices 6 and 0xe route to co-batch handlers (loc_21a6 / loc_24b7).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { decodeDisplayListSlotAndDispatch as cand } from "../decodeDisplayListSlotAndDispatch.js";
import { loc_2019 as oracle } from "../../translated/loc_2019.js";
import { drawAnimatedTileFigureAtPackedCoord } from "../drawAnimatedTileFigureAtPackedCoord.js";
import { drawScoreFieldByIndex } from "../drawScoreFieldByIndex.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const CURSOR = 0x40a1; // DISPLAY_LIST_CURSOR: the advanced read cursor lands here
const SCORE = 0x40a2; // P1 packed-BCD score (poked so the score arms do observable work)
const UPDATE_GATE = 0x4007; // loc_21a6 aborts (rst 08 double-return) when bit0 is set
const CONVOY = 0x40ac; // loc_24b7 arg=2 reads this; 0xff -> nothing to show

// Craft: A=index, HL=0x40:ptr, BOTH slot bytes poked (slot[0]=the control byte so its retire is observable,
// slot[1]=`arg`), a caller-return word, and any extra. slot[0] carries the real display-list control byte
// (== A) so the routine's unconditional retire of it (index -> 0xff) is visible to ramDiff.
function entry(index, ptr, arg, extra) {
  return craft((mem8, m) => {
    m.push16(0x9999);
    m.regs.a = index;
    m.regs.hl = 0x4000 | ptr;
    mem8[0x4000 | (ptr & 0xff)] = index;
    mem8[0x4000 | ((ptr + 1) & 0xff)] = arg;
    if (extra) extra(mem8, m);
  });
}

function runOracle(e) { const a = e.clone(); a.routines = STUBS; oracle(a); return a; }

// One representative non-vacuous entry per even handler index (ptr 0xc4 -> cursor 0xc6, no wrap).
const INDICES = [0x0, 0x2, 0x4, 0x6, 0x8, 0xa, 0xc, 0xe];
const ARMS = {
  0x0: () => entry(0x0, 0xc4, 0x00), // animated tile figure -> VRAM
  0x2: () => entry(0x2, 0xc4, 0x00), // fixed tile figure -> VRAM
  0x4: () => entry(0x4, 0xc4, 0x02), // 4x4 tile form 2 (four blocks)
  0x6: () => entry(0x6, 0xc4, 0x00, (mem) => { mem[UPDATE_GATE] = 0; mem[SCORE] = 0; }), // BCD score add
  0x8: () => entry(0x8, 0xc4, 0x00, (mem) => { mem[SCORE] = 0x99; }), // clear + redraw P1 score
  0xa: () => entry(0xa, 0xc4, 0x00, (mem) => { mem[SCORE] = 0x12; }), // redraw P1 score digits
  0xc: () => entry(0xc, 0xc4, 0x40), // message column, position mode
  0xe: () => entry(0xe, 0xc4, 0x02, (mem) => { mem[CONVOY] = 0x34; }), // convoy/level readout
};

test("EQUAL (crafted): loc_2019 == oracle on every handler index", { skip }, () => {
  for (const idx of INDICES) {
    assert.equal(ramDiff(oracle, cand, ARMS[idx]()), null, `index 0x${idx.toString(16)} diverged`);
    assert.ok(ramDiff(oracle, () => {}, ARMS[idx]()), `index 0x${idx.toString(16)} is vacuous (oracle changed no RAM)`);
  }
  // Decode positive controls: the craft seeds slot[0] non-0xff so its retire is observable; the oracle then
  // retires both slot bytes to 0xff and stores the advanced cursor.
  const seeded = entry(0x0, 0xc4, 0x00);
  assert.notEqual(seeded.mem8[0x40c4], 0xff, "craft seeds slot[0] non-0xff so its retire is observable");
  const a = runOracle(seeded);
  assert.equal(a.mem8[0x40c4], 0xff, "oracle retired the control byte (slot[0] 0x00 -> 0xff)");
  assert.equal(a.mem8[0x40c5], 0xff, "oracle retired the argument byte");
  assert.equal(a.mem8[CURSOR], 0xc6, "oracle stored the advanced cursor (0xc4 + 2)");
  console.log("  EQUAL: loc_2019 == oracle on all 8 handler indices; slots retired, cursor advanced");
});

test("WRAP: the cursor wraps to the list base below 0xc0", { skip }, () => {
  const wrap = entry(0x0, 0xfe, 0x00); // 0xfe + 2 -> 0x00 < 0xc0 -> wrap to 0xc0
  assert.equal(ramDiff(oracle, cand, wrap), null, "wrap arm diverged");
  assert.equal(runOracle(wrap).mem8[CURSOR], 0xc0, "positive control: oracle wrapped the cursor to 0xc0");
  assert.equal(runOracle(entry(0x0, 0xc4, 0x00)).mem8[CURSOR], 0xc6, "positive control: no wrap at/above 0xc0");
  // no-wrap twin: everything right but the cursor left un-wrapped (0x00 instead of 0xc0).
  const noWrap = (m) => {
    m.mem8[0x40fe] = 0xff; m.mem8[0x40ff] = 0xff; m.mem8[CURSOR] = 0x00;
    m.regs.a = 0x00; drawAnimatedTileFigureAtPackedCoord(m, 0x00);
  };
  assert.ok(ramDiff(oracle, noWrap, wrap), "the no-wrap twin escaped");
  console.log("  WRAP: cursor wraps to 0xc0 below the base; no-wrap twin caught");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const arm0 = () => entry(0x0, 0xc4, 0x00);
  // No-op twin: the decode alone (slot retire + cursor) already changes RAM.
  assert.ok(ramDiff(oracle, () => {}, arm0()), "the no-op twin escaped");
  // Dispatch-only twin: the right handler but no slot-retire / cursor store.
  const dispatchOnly = (m) => { m.regs.a = 0x00; drawAnimatedTileFigureAtPackedCoord(m, 0x00); };
  assert.ok(ramDiff(oracle, dispatchOnly, arm0()), "the dispatch-only twin escaped (retire/cursor not observed)");
  // Decode-only twin: slot-retire + cursor but no dispatch.
  const decodeOnly = (m) => { m.mem8[0x40c4] = 0xff; m.mem8[0x40c5] = 0xff; m.mem8[CURSOR] = 0xc6; };
  assert.ok(ramDiff(oracle, decodeOnly, arm0()), "the decode-only twin escaped (handler not observed)");
  // Skip-first-byte-retire twin: everything correct except slot[0] (the control byte) is left un-retired.
  const skipFirstRetire = (m) => {
    m.mem8[0x40c5] = 0xff; m.mem8[CURSOR] = 0xc6;
    m.regs.a = 0x00; drawAnimatedTileFigureAtPackedCoord(m, 0x00);
  };
  assert.ok(ramDiff(oracle, skipFirstRetire, arm0()), "the skip-first-byte-retire twin escaped (slot[0] retire not observed)");
  // Mis-dispatch twin: correct decode but the WRONG handler (score redraw instead of the tile figure).
  const misDispatch = (m) => {
    m.mem8[0x40c4] = 0xff; m.mem8[0x40c5] = 0xff; m.mem8[CURSOR] = 0xc6;
    m.regs.a = 0x00; drawScoreFieldByIndex(m, 0x00);
  };
  assert.ok(ramDiff(oracle, misDispatch, arm0()), "the mis-dispatch twin escaped (wrong handler matched)");
  console.log("  TEETH: no-op, dispatch-only, decode-only, skip-first-byte-retire, and mis-dispatch twins all caught");
});

test("SP-SEAM TOOTH: the absorbed tail-dispatch places at the seam", { skip }, () => {
  for (const [name, mk] of [
    ["index0", () => entry(0x0, 0xc4, 0x00)],
    ["message", () => entry(0xc, 0xc4, 0x40)],
    ["wrap", () => entry(0x0, 0xfe, 0x00)],
  ]) {
    const r = seamPlaceable(withOmittedRet, cand, 0x2019, mk());
    assert.equal(r.placeable, true, `seam refused the stack-neutral dispatch on ${name}: ${r.error}`);
  }
  const strayPush = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, strayPush, 0x2019, entry(0x0, 0xc4, 0x00));
  assert.equal(rm.placeable, false, "the stack-adrift mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral dispatch places on all arms; stray-push mutant refused");
});
