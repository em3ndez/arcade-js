// SPDX-License-Identifier: GPL-3.0-only
/** stepMotherShipWarpFlashFrame — one frame of an object's warp/flash sequence, entered through a misaligned prologue
 * that reads garbage words off the stack (two POP AF, a DEC SP) and folds the resulting carry into
 * a rare conditional life-loss. The body drifts the object with the world, then seeds the sprite's
 * heading and animation from tables gated on its angle and Y, and counts a state byte down: the
 * 0xB4 frame arms the flash, warps a sentinel and posts a sound; frames above it step an eight-shape
 * cycle; a spent counter resets to idle and either loops back or returns on two program-image gates.
 * The prologue's stack reads and the exit `ret` leave sp adrift and the flags scratch.
 * LIVE-OUT: memory. */

import { u16 } from "../../../core/int.js";
import { loseLifeAndHandOver } from "./loseLifeAndHandOver.js";
import { driftWithWorldScroll } from "./driftWithWorldScroll.js";
import { fetchTableByte } from "./fetchTableByte.js";
import { requestMotherShipWarpSound } from "./requestMotherShipWarpSound.js";
import { postCommand } from "./postCommand.js";
import { PLAYER_STATE, ROUND_TRANSITION_HOLD, TAMPER_GLYPH_COPY, loc_461b } from "./names.js";

const STATE = 0x00;
const HEADING = 0x31;
const SPRITE_STATE = 0x30;
const TRIGGER = 0xb4;

export function stepMotherShipWarpFlashFrame(m) {
  const { regs, mem, mem8 } = m;
  const X = (d) => u16(regs.ix + d);
  const Y = (d) => u16(regs.iy + d);

  for (;;) {
    // misaligned entry: two POP AF eat stack words, DEC SP leaves it odd; none of this writes RAM,
    // but the folded-in carry is what decides the rare life-loss.
    regs.d = 0xa7;
    regs.de = u16(regs.de + 1);
    regs.sub(mem8[regs.hl]);
    regs.af = m.pop16();
    regs.adc(regs.h);
    regs.l = regs.b;
    regs.sp = u16(regs.sp - 1);
    regs.c = regs.dec8(regs.c);
    regs.sbc(regs.e);
    regs.de = u16(regs.de + 4);
    regs.af = m.pop16();
    regs.adc(regs.b);
    if (regs.fC) loseLifeAndHandOver(m);
    regs.cp(regs.c);

    driftWithWorldScroll(m);

    // seed heading + animation, unless the sprite's angle or Y is out of range -> flag 0xFF instead
    let flatten = false;
    regs.a = mem8[Y(HEADING)];
    regs.b = regs.a;
    regs.add(0x13);
    regs.cp(0x03);
    if (regs.fC) {
      flatten = true;
    } else {
      regs.a = regs.b;
      regs.add(0x10);
      mem8[Y(0x33)] = regs.a;
      regs.a = mem8[Y(0x00)];
      regs.b = regs.a;
      regs.add(0x08);
      regs.cp(0x28);
      if (regs.fC) flatten = true;
      else mem8[Y(0x02)] = regs.b;
    }
    if (flatten) {
      mem8[Y(0x01)] = 0xff;
      mem8[Y(0x03)] = 0xff;
    }

    regs.a = mem8[X(STATE)];
    regs.cp(TRIGGER);
    if (regs.fZ) {
      // the trigger frame: arm the flash, warp the sentinel, post the sound and tail out
      regs.decMem8(mem, X(STATE));
      mem8[Y(0x01)] = 0xfe;
      mem8[Y(0x03)] = 0xfd;
      mem8[Y(SPRITE_STATE)] = 0x6c;
      mem8[Y(0x32)] = 0x6c;
      regs.a = regs.inc8(mem8[PLAYER_STATE]);
      if (regs.fZ) requestMotherShipWarpSound(m);
      regs.de = 0x040d;
      return postCommand(m);
    }
    if (!regs.fC) {
      // above the trigger: pick this frame's shape from the eight-entry table
      regs.sub(TRIGGER);
      regs.rrca();
      regs.rrca();
      regs.rrca();
      regs.a = regs.dec8(regs.a);
      regs.and(0x07);
      regs.hl = loc_461b;
      fetchTableByte(m);
      mem8[Y(0x03)] = regs.a;
      regs.a = regs.inc8(regs.a);
      mem8[Y(0x01)] = regs.a;
    }

    regs.decMem8(mem, X(STATE));
    if (regs.fZ) {
      // sequence spent: back to idle, then loop or return on two program-image gates
      regs.a = 0xff;
      mem8[ROUND_TRANSITION_HOLD] = regs.a;
      mem8[X(STATE)] = 0x00;
      regs.hl = TAMPER_GLYPH_COPY;
      regs.a = mem8[regs.hl];
      regs.cp(0x7c);
      if (regs.fZ) {
        regs.hl = u16(regs.hl + 1);
        regs.a = mem8[regs.hl];
        regs.cp(0x10);
        if (regs.fZ) return;
        regs.cp(0x05);
        if (regs.fZ) return;
      }
      continue;
    }

    regs.a = mem8[X(STATE)];
    regs.cp(0x5a);
    if (regs.fNZ) return;
    mem8[Y(0x01)] = 0xff;
    mem8[Y(0x03)] = 0xff;
    return;
  }
}
