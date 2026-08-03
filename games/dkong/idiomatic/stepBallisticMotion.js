// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepBallisticMotion — advance an airborne actor one frame along its ballistic arc.  ROM 0x239C.
 *
 * All fields are relative to the caller's record base. Read and written: the 16.8 horizontal
 * position (+3 whole, +4 fraction), the 16.8 vertical position (+5 whole, +6 fraction), and the
 * frame counter (+20). Read only: the horizontal velocity (+16,+17) and the launch vertical
 * speed (+18,+19), each signed 16-bit with the high byte first.
 *
 * Memory-equivalent to the frozen oracle — equivalence-239c.test.js.
 * GATE:     strict, on real captured dispatches; 29 of the 489 dispatches in a 1200-frame
 *           attract run, covering all 5 record bases attract uses, plus one whole-run check
 *           with this routine wired live. Attract only — no gameplay entry, no crafted arm.
 * LIVE-OUT: the new vertical position — returned, and also left in `h`. Four still-frozen
 *           callers reach here (ROM 0x1BB2, 0x1BEC, 0x2053, 0x20EC); only 0x20EC reads `h`
 *           back out. Everything else the oracle leaves in the registers and flags is dead,
 *           measured not assumed: the gate's whole-run check wires this routine live for 1200
 *           attract frames and the trace stays byte-identical to the all-oracle baseline;
 *           dropping `h` breaks that run at frame 623.
 * NAMES:    OBJ_X (+3) and OBJ_Y (+5). ram.js names the other five fields only as Mario's
 *           absolute cells, never as record-relative offsets, so those stay bare offsets — the
 *           base is a parameter and attract drives it with five different records.
 *
 * NAME: the vertical step subtracts a launch speed that is constant across the whole arc and
 * adds back a slice of (2n + 1) * 8 that widens with the frame counter, so the accumulated fall
 * is 8n² — quadratic, which is what makes the path an arc rather than a constant drift. An arc,
 * not a whole flight: the playfield-limit reflection at ROM 0x1BD8 re-bases the launch speed in
 * place and restarts the counter, starting a new arc without the actor landing.
 * Corroborated outside this body: ram.js carries the same law measured live under MAME on
 * Mario's record (ΔY16 = -(V + 8 - 16n), n taken after this routine advances it, 0 mismatches
 * over 142 airborne frames) — a measurement a constant per-frame step would have refuted.
 *
 * NOT CLAIMED: attract drives this from Mario's record and from four 0x67xx object records.
 * That the 0x67xx callers reach it only while their object is off the ground — the "airborne"
 * in the name — was not derived here.
 */

import { u16 } from "../../../core/int.js";
import { OBJ_X, OBJ_Y } from "./ram.js";

export function stepBallisticMotion(m, recordBase = m.regs.ix) {
  const { mem8 } = m;

  // Horizontal: the position gains the actor's velocity every frame, unchanged — nothing
  // accelerates this axis.
  const x = mem8[recordBase + OBJ_X] * 256 + mem8[recordBase + 4];
  const velocityX = mem8[recordBase + 16] * 256 + mem8[recordBase + 17];
  const nextX = u16(x + velocityX);
  mem8[recordBase + OBJ_X] = nextX >> 8;
  mem8[recordBase + 4] = nextX;

  // Vertical: the same launch speed comes off every frame while a widening gravity slice goes
  // back on, so the per-frame step shrinks, reverses, and then grows the other way.
  const framesSinceLaunch = mem8[recordBase + 20];
  const y = mem8[recordBase + OBJ_Y] * 256 + mem8[recordBase + 6];
  const launchSpeed = mem8[recordBase + 18] * 256 + mem8[recordBase + 19];
  const nextY = u16(y - launchSpeed + (2 * framesSinceLaunch + 1) * 8);
  mem8[recordBase + OBJ_Y] = nextY >> 8;
  mem8[recordBase + 6] = nextY;
  mem8[recordBase + 20] = framesSinceLaunch + 1;

  m.regs.h = nextY >> 8; // read back by the still-frozen caller at ROM 0x20EC
  return nextY;
}
