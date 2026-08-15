// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_29f9 — IX sprite-object motion arm. Active while (IX+6)!=0 and the global gate cell is 0;
 * counts down the (IX+9) move timer. On expiry it either — past sprite row 96 — steps (IX+3) by +/-2,
 * or drifts (IX+2) toward/away from the free-running counter, flipping the direction bit at the turn.
 * LIVE-OUT: memory-only (the sprite-object dispatcher).
 */
import { loc_842c, loc_8014 } from "./names.js";

const MOVE_RELOAD = 8;
const ROW_THRESHOLD = 96; // rows at/below take the (IX+3) step, above drift toward the free-running counter

export function loc_29f9(m) {
  const { regs, mem8 } = m;
  const obj = regs.ix;
  const spr = regs.iy;

  if (mem8[(obj + 0x06) & 0xffff] === 0) return; // inactive
  if (mem8[loc_842c] !== 0) return; // gated off

  const timer = (mem8[(obj + 0x09) & 0xffff] - 1) & 0xff;
  mem8[(obj + 0x09) & 0xffff] = timer;
  if (timer !== 0) return; // move timer still running
  mem8[(obj + 0x09) & 0xffff] = MOVE_RELOAD;

  const facing = mem8[(obj + 0x05) & 0xffff];
  mem8[(obj + 0x07) & 0xffff] = 1;

  if (mem8[(spr + 0x03) & 0xffff] >= ROW_THRESHOLD) {
    const step = facing === 0 ? -2 : 2;
    mem8[(obj + 0x03) & 0xffff] = (mem8[(obj + 0x03) & 0xffff] + step) & 0xff;
    return;
  }

  const trackX = mem8[loc_8014];
  if (facing === 0) {
    const anchor = mem8[(obj + 0x00) & 0xffff];
    if (trackX < anchor) return; // past the target, hold
    if (((trackX - anchor) & 0xff) >= mem8[(spr + 0x00) & 0xffff]) return turn();
    mem8[(obj + 0x02) & 0xffff] = (mem8[(obj + 0x02) & 0xffff] + 1) & 0xff; // step toward
  } else {
    const anchor = mem8[(obj + 0x01) & 0xffff];
    if (((trackX - anchor) & 0xff) < mem8[(spr + 0x00) & 0xffff]) return turn();
    mem8[(obj + 0x02) & 0xffff] = (mem8[(obj + 0x02) & 0xffff] - 1) & 0xff;
  }

  function turn() {
    mem8[(obj + 0x05) & 0xffff] = mem8[(obj + 0x05) & 0xffff] ^ 0x80; // flip direction + sprite flip bits
    mem8[(spr + 0x00) & 0xffff] = mem8[(spr + 0x04) & 0xffff];
    mem8[(spr + 0x01) & 0xffff] = mem8[(spr + 0x01) & 0xffff] ^ 0x80;
  }
}
