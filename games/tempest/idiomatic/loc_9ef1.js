// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  loc_9f, ENEMY_FIRE_SELECT, ENEMY_CLIMB_DELTA_LO_4, ENEMY_CLIMB_DELTA_HI_4, PLAYER_SHOT_DEPTH, ENEMY_SLOT_DIR, ENEMY_DEPTH_LO, ENEMY_DEPTH, FIRE_GATE,
} from "./names.js";
import { loc_9c99 } from "./loc_9c58.js";
import { loc_9f5f } from "./loc_9f5f.js";
import { loc_9f81, loc_9f8a } from "./loc_9f81.js";

// Per-slot(x) mover. ENEMY_SLOT_DIR,x bit7 set -> RE-SEEK: re-seek the slot the SUB way (with Y = 0x04) then
// dispatch on its returned high byte (A < 0x80 -> fire step; else bit6 of ENEMY_FIRE_SELECT selects one of two seek
// steps). bit7 clear -> ADVANCE: the 16-bit coordinate (low ENEMY_DEPTH_LO,x / high ENEMY_DEPTH,x) += the per-frame
// delta (low ENEMY_CLIMB_DELTA_LO_4 / high ENEMY_CLIMB_DELTA_HI_4, with carry); a new hi below the floor PLAYER_SHOT_DEPTH is clamped to it. A
// carry then selects the terminal step: it is produced only when FIRE_GATE != 0 and either zp loc_9f >= 0x11
// or the new hi >= 0x20; the clamp arm always leaves it clear. carry set -> fire step; carry clear ->
// ENEMY_FIRE_SELECT bit7 picks one of the two seek steps. FIRE_GATE == 0 returns early (A = new hi, Y = 0). Every
// non-early path tail-delegates, so its register state belongs to the chosen callee.
export function loc_9ef1(m, x = m.regs.x) {
  const { mem8 } = m;

  if (mem8[u16(ENEMY_SLOT_DIR + x)] & 0x80) {
    // RE-SEEK: the sub-step returns the new high byte in A (Y is still 0x04 from entry).
    const a = loc_9c99(m, x, 0x04);
    if (a < 0x80) return loc_9f5f(m, x);
    if ((mem8[ENEMY_FIRE_SELECT] & 0x40) === 0) return loc_9f8a(m, x);
    return loc_9f81(m, x);
  }

  // ADVANCE: 16-bit coordinate += per-frame delta.
  const loSum = mem8[u16(ENEMY_DEPTH_LO + x)] + mem8[ENEMY_CLIMB_DELTA_LO_4]; // clc: carry-in 0
  mem8[u16(ENEMY_DEPTH_LO + x)] = loSum;
  const carryIn = loSum > 0xff ? 1 : 0;
  const hi = u8(mem8[u16(ENEMY_DEPTH + x)] + mem8[ENEMY_CLIMB_DELTA_HI_4] + carryIn);
  mem8[u16(ENEMY_DEPTH + x)] = hi;

  const floor = mem8[PLAYER_SHOT_DEPTH];
  let fire; // the carry that selects the fire step
  if (hi >= floor) {
    // keep the new hi
    if (mem8[FIRE_GATE] === 0) return (m.regs.a = hi); // beq -> early rts (Y-out unconsumed, not seated)
    fire = (mem8[loc_9f] >= 0x11) ? 1 : (hi >= 0x20 ? 1 : 0); // cpy #0x11 / cmp #0x20
  } else {
    mem8[u16(ENEMY_DEPTH + x)] = floor; // clamp the hi byte to the floor
    fire = 0;
  }

  if (fire) return loc_9f5f(m, x);              // carry set -> fire step
  if (mem8[ENEMY_FIRE_SELECT] & 0x80) return loc_9f81(m, x); // ENEMY_FIRE_SELECT sign set -> seek step
  return loc_9f8a(m, x);                          // ENEMY_FIRE_SELECT sign clear -> the other seek step
}
