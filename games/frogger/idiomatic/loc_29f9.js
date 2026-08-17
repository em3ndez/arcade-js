// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_29f9 — IX sprite-object motion arm. Active while (IX+6)!=0 and the global gate cell is 0;
 * counts down the (IX+9) move timer. On expiry it either — past sprite row 96 — steps (IX+3) by +/-2,
 * or drifts (IX+2) toward/away from the free-running counter, flipping the direction bit at the turn.
 * LIVE-OUT: memory-only (the sprite-object dispatcher).
 */
import { loc_842c, FREE_RUNNING_POS_COUNTER } from "./names.js";

const MOVE_RELOAD = 8;
const ROW_THRESHOLD = 96; // rows at/below take the (IX+3) step, above drift toward the free-running counter

export function loc_29f9(m, obj = m.regs.ix, spr = m.regs.iy) {
  const { mem8 } = m;

  if (mem8[(obj + 0x06)] === 0) return;
  if (mem8[loc_842c] !== 0) return;

  const timer = (mem8[(obj + 0x09)] - 1) & 0xff;
  mem8[(obj + 0x09)] = timer;
  if (timer !== 0) return;
  mem8[(obj + 0x09)] = MOVE_RELOAD;

  const facing = mem8[(obj + 0x05)];
  mem8[(obj + 0x07)] = 1;

  if (mem8[(spr + 0x03)] >= ROW_THRESHOLD) {
    const step = facing === 0 ? -2 : 2;
    mem8[(obj + 0x03)] = (mem8[(obj + 0x03)] + step) & 0xff;
    return;
  }

  const trackX = mem8[FREE_RUNNING_POS_COUNTER];
  if (facing === 0) {
    const anchor = mem8[(obj + 0x00)];
    if (trackX < anchor) return; // past the target, hold
    if (((trackX - anchor) & 0xff) >= mem8[(spr + 0x00)]) return turn();
    mem8[(obj + 0x02)] = (mem8[(obj + 0x02)] + 1) & 0xff; // step toward
  } else {
    const anchor = mem8[(obj + 0x01)];
    if (((trackX - anchor) & 0xff) < mem8[(spr + 0x00)]) return turn();
    mem8[(obj + 0x02)] = (mem8[(obj + 0x02)] - 1) & 0xff;
  }

  function turn() {
    mem8[(obj + 0x05)] = mem8[(obj + 0x05)] ^ 0x80; // flip direction + sprite flip bits
    mem8[(spr + 0x00)] = mem8[(spr + 0x04)];
    mem8[(spr + 0x01)] = mem8[(spr + 0x01)] ^ 0x80;
  }
}
