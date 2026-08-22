// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import { loc_0f15 } from "./loc_0f15.js";
import { FLIP_SCREEN_FLAG, GRAB_ACTIVE_FLAG, LANDING_ANIM_SEQ_40B4 } from "./names.js";
/**
 * loc_5e1f — proximity trigger for one slot of the caller's target sweep (a dissolved skip).
 *
 * Returns true on every "no grab" path (the caller keeps sweeping) and false on the grab-hit
 * path (the caller aborts its sweep). A record state of 0 or 5 short-circuits to true. Otherwise
 * it builds target coordinates from the source record (source+0 / source+2) plus a sign offset
 * (0x09/0x00 normally, 0xf7/0x10 when the screen-flip flag is clear), then measures |dx| against
 * (target+0) and |dy| against (target+2)+8; if dx >= 2 or dy >= 9 it returns true. On a hit it
 * raises the grab latch, installs the landing animation on the record, seeds the record's actor
 * fields, fires the grab sound, and returns false.
 *
 * LIVE-OUT: boolean only (true = continue the sweep, false = abort it). No register survives —
 * the caller reloads DE next and the abort path leaves AF as scratch; the record pointer is used
 * only to address the hit record locally.
 */

export function loc_5e1f(m, rec = m.regs.hl, source = m.regs.ix, target = m.regs.iy) {
  const { mem8 } = m;

  const state = mem8[rec];
  if (state === 0x00 || state === 0x05) return true;

  let offX, offY;
  if (mem8[FLIP_SCREEN_FLAG] !== 0) {
    offX = 0x09;
    offY = 0x00;
  } else {
    offX = 0xf7;
    offY = 0x10;
  }
  const tx = (mem8[source + 0x00] + offX) & 0xff;
  const ty = (mem8[source + 0x02] + offY) & 0xff;

  const bx = mem8[target + 0x00];
  let dx = (bx - tx) & 0xff;
  if (bx < tx) dx = (-dx) & 0xff; // borrow -> two's complement gives |dx|
  if (dx >= 0x02) return true;

  const by = (mem8[target + 0x02] + 0x08) & 0xff;
  let dy = (by - ty) & 0xff;
  if (by < ty) dy = (-dy) & 0xff;
  if (dy >= 0x09) return true;

  mem8[GRAB_ACTIVE_FLAG] = 0x01;
  setActorAnimation(m, rec, LANDING_ANIM_SEQ_40B4);
  mem8[rec + 0x11] = 0x0a;
  mem8[rec + 0x00] = 0x00;
  mem8[rec + 0x01] = 0x01;
  mem8[rec + 0x02] = 0x02;
  loc_0f15(m);
  return false;
}
