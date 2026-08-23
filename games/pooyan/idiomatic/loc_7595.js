// SPDX-License-Identifier: GPL-3.0-only
import { loc_0020 } from "./loc_0020.js";
import { loc_0c45 } from "./loc_0c45.js";
import { setActorAnimation } from "./setActorAnimation.js";
import {
  WAVE_NUMBER,
  SHARED_FRAME_DELAY_TIMER,
  EAGLE_LAUNCH_VARIANT_INDEX,
  EAGLE_LAUNCH_VARIANT_TABLE,
  LAUNCH_FRAME_DELAY_TABLE,
  ACTOR_ANIM_TABLE_5657,
  ANIM_PARAM_76D4,
  ANIM_PARAM_76DD,
} from "./names.js";
/**
 * loc_7595 — try to launch one record into a free slot (dissolved caller-skip).
 *
 * The caller sweeps the paired record tables and invokes this once per record. An already-active
 * slot (bit 0 of either of IX's first two bytes) is left untouched and returns true, so the caller
 * keeps sweeping. A free slot launches: the IX record is stamped and, from wave two on, the paired
 * IY record too — its state seeded, an anim-variant byte drawn from the variant table (indexed by
 * the launch-variant cursor) and pointed at its animation sequence. The shared frame-delay is
 * reseeded from the launch table (index clamped to two), the wave counter advances, the IX record is
 * armed with the launch animation (a later wave uses the alternate sequence), and the IY hold field
 * is set to four times the wave. It then returns false, so the caller aborts its record sweep.
 *
 * SEATING: caller-skip — false unwinds past the caller (net stack move the dispatch seam cannot
 * seat), so the caller must direct-call this boolean, not marshal it through the seam.
 * LIVE-OUT: boolean (true = slot occupied / keep sweeping, false = launched / abort). Memory: the
 * two records, the variant cursor, the wave counter, and the shared frame-delay.
 */

export function loc_7595(m, ix = m.regs.ix, iy = m.regs.iy) {
  const { mem8 } = m;
  if (((mem8[ix] | mem8[ix + 1]) & 0x01) !== 0) return true; // slot occupied -> keep sweeping

  // Stamp the IX record.
  mem8[ix + 0x00] = 0x01; // mark active
  mem8[ix + 0x03] = 0x00;
  mem8[ix + 0x05] = 0x00;
  mem8[ix + 0x04] = 0x15;
  mem8[ix + 0x06] = 0x1e;

  // From wave two on, also stamp the paired IY record.
  if (mem8[WAVE_NUMBER] >= 0x02) {
    mem8[iy + 0x03] = 0x00;
    mem8[iy + 0x05] = 0x00;
    mem8[iy + 0x04] = 0x14;
    mem8[iy + 0x06] = 0x1e;
    const variantIndex = mem8[EAGLE_LAUNCH_VARIANT_INDEX];
    const [variant] = loc_0020(m, EAGLE_LAUNCH_VARIANT_TABLE, variantIndex);
    mem8[iy + 0x17] = variant;
    const sequence = loc_0c45(m, variant, ACTOR_ANIM_TABLE_5657);
    mem8[iy + 0x0c] = sequence; //      low byte (the store masks)
    mem8[iy + 0x0d] = sequence >> 8;
    mem8[iy + 0x09] = 0x18;
    mem8[iy + 0x00] = 0x01; // activate the paired record
    mem8[EAGLE_LAUNCH_VARIANT_INDEX] = variantIndex + 1;
  }

  mem8[ix + 0x09] = 0x18;

  // Reseed the shared frame-delay from the launch table (index clamped to two).
  const wave = mem8[WAVE_NUMBER];
  const [delay] = loc_0020(m, LAUNCH_FRAME_DELAY_TABLE, wave < 0x02 ? wave : 0x02);
  mem8[SHARED_FRAME_DELAY_TIMER] = delay;

  // Advance the wave and arm the IX record's launch animation.
  mem8[WAVE_NUMBER] = mem8[WAVE_NUMBER] + 1; // wraps at 256 (the store masks)
  const nextWave = mem8[WAVE_NUMBER];
  setActorAnimation(m, ix, nextWave >= 0x03 ? ANIM_PARAM_76DD : ANIM_PARAM_76D4);

  mem8[iy + 0x11] = nextWave << 2; // hold field = wave * 4 (the store masks)

  return false; // launched -> caller aborts its record sweep (caller-skip)
}
