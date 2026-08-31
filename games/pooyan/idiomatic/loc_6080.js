// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_60f2 } from "./loc_60f2.js";
import { loc_60bc } from "./loc_60bc.js";
import { FLIP_SCREEN_FLAG } from "./names.js";
/**
 * loc_6080 — the even-round proximity gate of the object-proximity collision scan.
 *
 * WHAT IT IS
 *   One record's worth of the per-frame collision sweep. The scan head (loc_6069) has already
 *   confirmed the current record is live and, because the round counter is even, routed control
 *   here to decide whether the moving actor and the reference object are close enough to count as
 *   a hit. This routine is the actual overlap test: it measures the gap on each screen axis
 *   between the actor's coordinate and the reference object's coordinate and compares each gap to
 *   a fixed window.
 *     - MISS — either axis is too far apart. Control tail-jumps to the scan epilogue (loc_60f2),
 *       which steps to the next actor/record pair and re-enters the scan while records remain.
 *     - HIT — both axes fall inside the window. The record pointer is advanced to the record's
 *       collision tag, and control enters the hit handler (loc_60bc) with that tag as the key it
 *       hunts for in the enemy actor pool.
 *
 *   The X axis carries a flip-dependent bias: a sprite's horizontal hotspot lands on a different
 *   edge when the screen is mirrored, so the actor's X picks up +6 in the upright orientation and
 *   -2 when the display is mirrored before the gap is taken. Both Y coordinates are shifted +8 to
 *   their sprite midpoints before they are differenced.
 *
 *   ROLE IN THE MACHINE: the even-round branch of the per-record overlap test inside the
 *   object-proximity collision scan (see mechanisms.md "The object-proximity collision scan").
 *   The scan head decides a record is worth testing; this gate decides WHETHER the actor overlaps
 *   it; on a hit loc_60bc decides WHAT the overlap means (capture the target, or resolve it
 *   against the enemy pool). Odd rounds take a different handler (loc_61b4) from the same head.
 *
 *   ROM: 0x6080 (0x6080-0x60bb).
 *   Grounding: [seen]
 *
 * INPUTS
 *   hl    — the current record pointer; its +0x14 field is the collision tag handed to the hit
 *           handler on a hit.
 *   ix    — the moving actor's coordinate slot: screen X at +0, screen Y at +2.
 *   iy    — the reference object's coordinate slot: screen X at +0, screen Y at +2.
 *   count — records still to sweep; forwarded to the epilogue on a miss so the loop can continue.
 *   ireg  — the interrupt vector register, forwarded so the hit handler can pick its parity slot.
 *
 * LIVE-OUT
 *   A boolean forwarded from whichever path is taken:
 *     - true  = normal completion (the sweep may continue; the frame is not unwound);
 *     - false = a caller-skip: the frame must be unwound.
 *   No register value is meant to be read back.
 */
// Offset from a record's base to its collision tag. On a hit the record pointer is advanced by
// this much (ROM 0x60b2/0x60b3, `ld de,0x0014` / `add hl,de`) and the tag byte there becomes the
// key the hit handler matches against the enemy actor pool.
const TAG_OFFSET = 0x14;
// Overlap windows (ROM `cp` compares at 0x609f / 0x60ad): a gap greater than or equal to the limit
// misses. X tolerates up to 8 pixels, Y up to 7.
const X_GAP_LIMIT = 0x09;
const Y_GAP_LIMIT = 0x08;

export function loc_6080(m, hl = m.regs.hl, ix = m.regs.ix, count = m.regs.b, iy = m.regs.iy, ireg = m.regs.i) {
  const { mem8 } = m;
  // Horizontal hotspot bias keyed to screen orientation (ROM 0x6082-0x608a reads FLIP_SCREEN_FLAG
  // at 0x881f): +6 upright, -2 when the screen is mirrored. This lines the actor's X reference
  // point up with the reference object's before the gap is measured.
  const bias = mem8[FLIP_SCREEN_FLAG] !== 0 ? 6 : -2;
  // Actor screen coordinates, centred for the comparison: X = (ix+0) + flip bias (ROM 0x608d read,
  // 0x608e add); Y = (ix+2) + 8, shifting to the sprite midpoint (ROM 0x6092 read, 0x6094 add).
  const ax = (mem8[ix] + bias) & 0xff;
  const ay = (mem8[u16(ix + 2)] + 8) & 0xff;
  // X-axis gate: distance between the reference object's X (iy+0, ROM 0x6098) and the biased actor
  // X. |gap| >= 9 (ROM `cp 0x09` at 0x609f) is too far apart -> miss, hand off to the epilogue.
  if (Math.abs(mem8[iy] - ax) >= X_GAP_LIMIT) return loc_60f2(m, hl, ix, count, iy, ireg);
  // Y-axis gate: distance between the reference object's midpoint-shifted Y ((iy+2)+8, ROM 0x60a4
  // read, 0x60a6 add) and the actor's. |gap| >= 8 (ROM `cp 0x08` at 0x60ad) misses.
  if (Math.abs(((mem8[u16(iy + 2)] + 8) & 0xff) - ay) >= Y_GAP_LIMIT) return loc_60f2(m, hl, ix, count, iy, ireg);
  // Both axes inside the window: a hit. Advance the record pointer to the record's collision tag
  // (record base + 0x14) and read that tag byte (ROM 0x60b8).
  const rec = u16(hl + TAG_OFFSET);
  return loc_60bc(m, rec, mem8[rec], ireg); // hit: enter the handler keyed on the record tag
}
