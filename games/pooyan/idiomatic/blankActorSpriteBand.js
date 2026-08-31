// SPDX-License-Identifier: GPL-3.0-only
import { fillByteRun } from "./fillByteRun.js";
/**
 * blankActorSpriteBand — blank an actor's sprite band.
 * Fills a fixed-length run of bytes at the actor-record pointer with zero, clearing the band, by
 * delegating to the shared run-fill helper.
 * LIVE-OUT: HL = the advanced pointer past the filled run, and B = 0 (the drained fill counter),
 * both set by the helper, so a tail-jump caller inherits this exit state. The fill byte is a
 * fixed input, not read back.
 */
const BAND_FILL = 0x00; // the band is cleared to zero
const BAND_LEN = 0x17;  // bytes in the sprite band

export function blankActorSpriteBand(m, base = m.regs.ix) {
  return fillByteRun(m, base, BAND_FILL, BAND_LEN);
}
