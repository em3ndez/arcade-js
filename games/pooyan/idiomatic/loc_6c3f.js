// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  PLAYER_AIM_FLAGS,
  PROXIMITY_HIT_FLAG,
  AIM_INDICATOR_MODE,
  AIM_INDICATOR_TIMER,
} from "./names.js";

/**
 * loc_6c3f — proximity test of the fixed sprite record (ix) against one target (iy),
 * gated on bit0 of the projectile record (hl). The boolean encodes the control outcome:
 * true = continue (the scanning caller keeps going), false = abort (a hit was scored, so
 * the caller stops its scan). A hit needs the target inside both bands (x within X_BAND,
 * y within Y_BAND); it then marks PROXIMITY_HIT_FLAG, sets the above/below aim bit on
 * PLAYER_AIM_FLAGS from the record's type byte and the y sign, and on two of the four
 * branches arms the indicator latch (AIM_INDICATOR_MODE + AIM_INDICATOR_TIMER).
 *
 * LIVE-OUT: the boolean only — no register survives to the caller.
 */

const AIM_ABOVE = 0x04; //   PLAYER_AIM_FLAGS bit2: target is above the record
const AIM_BELOW = 0x08; //   PLAYER_AIM_FLAGS bit3: target is below the record
const X_BAND = 0x18; //      max |x-distance| for a hit
const Y_BAND = 0x0e; //      max |y-distance| for a hit
const INDICATOR_RELOAD = 0x18; // AIM_INDICATOR_TIMER reload on a timed hit

export function loc_6c3f(m, ix = m.regs.ix, iy = m.regs.iy, hl = m.regs.hl) {
  const { mem8 } = m;

  // gate closed unless the projectile record is active
  if ((mem8[hl] & 0x01) === 0) return true;

  const recX = (mem8[ix] + 0x10) & 0xff;
  const tgtX = (mem8[iy] + 0x20) & 0xff;
  if (Math.abs(tgtX - recX) >= X_BAND) return true; // out of the x-band

  const recY = mem8[u16(ix + 2)];
  const tgtY = (mem8[u16(iy + 2)] + 0x08) & 0xff;
  const targetBelow = tgtY < recY; // a borrow means the target sits below the record
  if (Math.abs(tgtY - recY) >= Y_BAND) return true; // out of the y-band

  // hit: record it, then pick the indicator from the record type byte and the y sign
  mem8[PROXIMITY_HIT_FLAG] = 0x01;
  const typeByte = mem8[u16(ix + 2)];

  const setAbove = () => { mem8[PLAYER_AIM_FLAGS] = (mem8[PLAYER_AIM_FLAGS] | AIM_ABOVE) & ~AIM_BELOW; };
  const setBelow = () => { mem8[PLAYER_AIM_FLAGS] = (mem8[PLAYER_AIM_FLAGS] | AIM_BELOW) & ~AIM_ABOVE; };
  const armIndicator = (mode) => {
    mem8[AIM_INDICATOR_MODE] = mode;
    mem8[AIM_INDICATOR_TIMER] = INDICATOR_RELOAD;
  };

  if (!targetBelow) {
    if (typeByte >= 0x51) setAbove(); // above, no latch
    else { setBelow(); armIndicator(2); } // below, latch mode 2
  } else if (typeByte < 0xb6) {
    if (typeByte < 0x51) { setBelow(); armIndicator(2); } // below, latch mode 2
    else setBelow(); // below, no latch
  } else {
    setAbove(); // above, latch mode 1
    armIndicator(1);
  }
  return false;
}
