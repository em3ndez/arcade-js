// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  PLAYER_AIM_FLAGS,
  PROXIMITY_HIT_FLAG,
  AIM_INDICATOR_MODE,
  AIM_INDICATOR_TIMER,
} from "./names.js";

/**
 * testTargetProximityAndSetAimDirection — proximity test of one actor record against one target, ROM 0x6c3f-0x6caa. [seen]
 *
 * Part of Pooyan's aiming/hit logic. A caller scans a list of targets, calling this once per
 * target to ask "is this target close enough to the actor to count as a hit, and if so which
 * way is it — above or below?". The actor record is the one addressed by `ix` (its X at +0,
 * its Y at +2, and a "type" byte also read from +2); the target record is `iy` (X at +0,
 * Y at +2). The whole test is gated by bit0 of a third record, `hl`: if that active bit is
 * clear the target is skipped and the scan continues.
 *
 * "Close enough" means the target sits inside a rectangular band around the actor — its X
 * within X_BAND and its Y within Y_BAND, each measured after a small fixed offset that lines
 * the two records' coordinate origins up. A miss on either axis returns "keep scanning".
 *
 * On a hit the routine records the outcome for the rest of the aim machinery:
 *   - PROXIMITY_HIT_FLAG (0x8d54) is set to 1 — the scan found a target in band.
 *   - The above/below aim bit on PLAYER_AIM_FLAGS (0x8a87) is set: bit2 (AIM_ABOVE) when the
 *     target is above the actor, bit3 (AIM_BELOW) when below, always clearing the other so
 *     only one direction shows. The choice is driven by the y sign together with the actor's
 *     type byte, which distinguishes the several kinds of actor that share this test.
 *   - On the two branches that represent a "timed" hit, the aim indicator is armed:
 *     AIM_INDICATOR_MODE (0x8d52) selects which direction the indicator draws (1 = above,
 *     2 = below) and AIM_INDICATOR_TIMER (0x8d53) is reloaded to 0x18 as its countdown.
 *
 * The boolean result encodes control for the scanning caller: true = continue (no hit here,
 * keep scanning the target list), false = abort (a hit was scored, stop the scan).
 *
 * LIVE-OUT: the boolean only — no register survives to the caller. All lasting effects are
 * the memory writes above, and only on a hit.
 */

const AIM_ABOVE = 0x04; //   PLAYER_AIM_FLAGS bit2: target is above the record
const AIM_BELOW = 0x08; //   PLAYER_AIM_FLAGS bit3: target is below the record
const X_BAND = 0x18; //      max |x-distance| for a hit
const Y_BAND = 0x0e; //      max |y-distance| for a hit
const INDICATOR_RELOAD = 0x18; // AIM_INDICATOR_TIMER reload on a timed hit

export function testTargetProximityAndSetAimDirection(m, ix = m.regs.ix, iy = m.regs.iy, hl = m.regs.hl) {
  const { mem8 } = m;

  // Gate: bit0 of the (hl) record is its "active" bit. If it is clear this target is not in
  // play, so report "keep scanning" without touching any aim state.
  if ((mem8[hl] & 0x01) === 0) return true;

  // X-band test. Offset each X so the actor's and target's coordinate origins align (the
  // actor's +0x10, the target's +0x20), then require them within X_BAND of each other.
  const recX = (mem8[ix] + 0x10) & 0xff;
  const tgtX = (mem8[iy] + 0x20) & 0xff;
  if (Math.abs(tgtX - recX) >= X_BAND) return true; // out of the x-band

  // Y-band test, same idea with the target's Y offset by +0x08. The comparison's borrow also
  // tells us the vertical direction: the target is below the actor when its Y is the smaller.
  const recY = mem8[u16(ix + 2)];
  const tgtY = (mem8[u16(iy + 2)] + 0x08) & 0xff;
  const targetBelow = tgtY < recY; // a borrow means the target sits below the record
  if (Math.abs(tgtY - recY) >= Y_BAND) return true; // out of the y-band

  // In band on both axes = a hit. Mark PROXIMITY_HIT_FLAG (0x8d54); the type byte at (ix+2)
  // selects between the actor kinds and, with the y sign above, picks the aim direction below.
  mem8[PROXIMITY_HIT_FLAG] = 0x01;
  const typeByte = mem8[u16(ix + 2)];

  const setAbove = () => { mem8[PLAYER_AIM_FLAGS] = (mem8[PLAYER_AIM_FLAGS] | AIM_ABOVE) & ~AIM_BELOW; };
  const setBelow = () => { mem8[PLAYER_AIM_FLAGS] = (mem8[PLAYER_AIM_FLAGS] | AIM_BELOW) & ~AIM_ABOVE; };
  const armIndicator = (mode) => {
    mem8[AIM_INDICATOR_MODE] = mode;
    mem8[AIM_INDICATOR_TIMER] = INDICATOR_RELOAD;
  };

  // Four-way choice of aim direction and whether to arm the indicator, keyed on the y sign
  // (targetBelow) and thresholds in the actor type byte (0x51, 0xb6). Two branches merely set
  // the direction bit; the other two additionally arm the timed indicator latch.
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
  // A hit was scored, so tell the caller to stop scanning the target list.
  return false;
}
