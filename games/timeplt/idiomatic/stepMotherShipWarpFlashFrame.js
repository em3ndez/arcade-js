// SPDX-License-Identifier: GPL-3.0-only
/** stepMotherShipWarpFlashFrame — one frame of an object's warp/flash sequence, entered through a misaligned prologue
 * that reads garbage words off the stack (two POP AF, a DEC SP) and folds the resulting carry into
 * a rare conditional life-loss. The body drifts the object with the world, then seeds the sprite's
 * heading and animation from tables gated on its angle and Y, and counts a state byte down: the
 * 0xB4 frame arms the flash, warps a sentinel and posts a sound; frames above it step an eight-shape
 * cycle; a spent counter resets to idle and either loops back or returns on two program-image gates.
 * The prologue's stack reads and the exit `ret` leave sp adrift and the flags scratch.
 * LIVE-OUT: memory. Every register the body touches is dead-after-return scratch — the sole caller
 * (loc_43f0_4646, a tail call) reads none of them, and its own equivalence gate excludes the whole
 * main register file, so nothing downstream pins them. Only b survives across the loop's `continue`,
 * so it is carried as a local; ix/iy/sp/b enter as boundary defaults. */

import { u8, u16 } from "../../../core/int.js";
import { loseLifeAndHandOver } from "./loseLifeAndHandOver.js";
import { driftWithWorldScroll } from "./driftWithWorldScroll.js";
import { fetchTableByte } from "./fetchTableByte.js";
import { requestMotherShipWarpSound } from "./requestMotherShipWarpSound.js";
import { postCommand } from "./postCommand.js";
import { PLAYER_STATE, ROUND_TRANSITION_HOLD, TAMPER_GLYPH_COPY, MOTHER_SHIP_WARP_SHAPE_TABLE } from "./names.js";

const STATE = 0x00;
const HEADING = 0x31;
const SPRITE_STATE = 0x30;
const TRIGGER = 0xb4;

export function stepMotherShipWarpFlashFrame(m, b = m.regs.b, ix = m.regs.ix, iy = m.regs.iy) {
  const { mem8 } = m;
  const X = (d) => u16(ix + d);
  const Y = (d) => u16(iy + d);

  for (;;) {
    // misaligned entry: two POP AF eat stack words and a DEC SP leaves sp odd; none of it writes RAM.
    // The second POP AF reloads both A and F, so only that word and the carried b reach the branch —
    // A = word>>8, the carry-in is bit 0 of F (word&1), and ADC A,B's carry-out arms the rare life-loss.
    m.pop16();
    m.regs.sp = u16(m.regs.sp - 1);
    const word = m.pop16();
    if ((word >> 8) + b + (word & 0x01) > 0xff) loseLifeAndHandOver(m);

    driftWithWorldScroll(m);

    // seed heading + animation, unless the sprite's angle or Y is out of range -> flag 0xFF instead
    let flatten = false;
    const heading = mem8[Y(HEADING)];
    b = heading;
    if (u8(heading + 0x13) < 0x03) {
      flatten = true;
    } else {
      mem8[Y(0x33)] = u8(heading + 0x10);
      const yval = mem8[Y(0x00)];
      b = yval;
      if (u8(yval + 0x08) < 0x28) flatten = true;
      else mem8[Y(0x02)] = yval;
    }
    if (flatten) {
      mem8[Y(0x01)] = 0xff;
      mem8[Y(0x03)] = 0xff;
    }

    const state = mem8[X(STATE)];
    if (state === TRIGGER) {
      // the trigger frame: arm the flash, warp the sentinel, post the sound and tail out
      mem8[X(STATE)] = u8(state - 1);
      mem8[Y(0x01)] = 0xfe;
      mem8[Y(0x03)] = 0xfd;
      mem8[Y(SPRITE_STATE)] = 0x6c;
      mem8[Y(0x32)] = 0x6c;
      if (u8(mem8[PLAYER_STATE] + 1) === 0) requestMotherShipWarpSound(m);
      return postCommand(m, 0x04, 0x0d);
    }
    if (state > TRIGGER) {
      // above the trigger: pick this frame's shape from the eight-entry table
      let sh = u8(state - TRIGGER);
      sh = ((sh >> 3) | (sh << 5)) & 0xff; // RRCA x3
      sh = u8(sh - 1) & 0x07;
      const shape = fetchTableByte(m, MOTHER_SHIP_WARP_SHAPE_TABLE, sh);
      mem8[Y(0x03)] = shape;
      mem8[Y(0x01)] = u8(shape + 1);
    }

    const spent = u8(mem8[X(STATE)] - 1);
    mem8[X(STATE)] = spent;
    if (spent === 0) {
      // sequence spent: back to idle, then loop or return on two program-image gates
      mem8[ROUND_TRANSITION_HOLD] = 0xff;
      mem8[X(STATE)] = 0x00;
      if (mem8[TAMPER_GLYPH_COPY] === 0x7c) {
        const nxt = mem8[u16(TAMPER_GLYPH_COPY + 1)];
        if (nxt === 0x10) return;
        if (nxt === 0x05) return;
      }
      continue;
    }

    if (mem8[X(STATE)] !== 0x5a) return;
    mem8[Y(0x01)] = 0xff;
    mem8[Y(0x03)] = 0xff;
    return;
  }
}
