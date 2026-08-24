// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_39ba } from "./loc_39ba.js";
import { loc_39e0 } from "./loc_39e0.js";
import { blankActorSpriteBand } from "./blankActorSpriteBand.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { ANIM_TABLE_3829 } from "./names.js";
/**
 * loc_3b87 — horizontal-travel phase of an enemy actor whose (+8) bit0 is clear.
 *
 * With (+8) bit0 set instead, it hands to the vertical mover. Otherwise it advances the
 * sub-position (+3) by velocity (+0x0a), carrying into the integer position (+4). When state (+7) is
 * zero it runs the land test — blanking the sprite band once (+4) reaches 0x1b. With (+7) nonzero it
 * keeps travelling until (+4) reaches 0x1d, at which point it retires the actor: advance
 * state, clear flags, and queue the retire animation.
 *
 * LIVE-OUT: none — rets or tail-delegates; all effect lands in the IX actor record.
 */
export function loc_3b87(m, rec = m.regs.ix) {
  const { mem8 } = m;

  if (mem8[rec + 0x08] & 0x01) return loc_39ba(m, rec); // bit0 set -> vertical mover

  const sum = mem8[rec + 0x03] + mem8[rec + 0x0a];
  if (sum > 0xff) mem8[rec + 0x04] = u8(mem8[rec + 0x04] + 1); // carry into the integer position
  mem8[rec + 0x03] = u8(sum);

  const posHigh = mem8[rec + 0x04];
  if (mem8[rec + 0x07] === 0) {
    if (posHigh >= 0x1b) blankActorSpriteBand(m, rec); // landed -> blank the band
    return;
  }

  if (posHigh < 0x1d) return loc_39e0(m, rec); // still travelling

  mem8[rec + 0x02] = u8(mem8[rec + 0x02] + 1); // retire: advance to the next state
  mem8[rec + 0x00] = 0x00;
  mem8[rec + 0x01] = 0x01;
  mem8[rec + 0x08] &= ~1; // clear the travel bit
  mem8[rec + 0x09] = 0x20;
  mem8[rec + 0x14] = 0x00;
  return setActorAnimation(m, rec, ANIM_TABLE_3829); // queue the retire animation (tail)
}
