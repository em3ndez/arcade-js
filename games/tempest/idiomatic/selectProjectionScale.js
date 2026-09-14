// SPDX-License-Identifier: GPL-3.0-only
import { loc_117, loc_3d, VG_MODE_FLAG, VG_SCALE } from "./names.js";

/**
 * selectProjectionScale — choose the vector-generator projection scale and mode bit from two gates. ROM 0xca48.
 *
 * Role in the machine: Tempest's tube is drawn through the vector generator, and the depth-projection of
 * a shape depends on a scale factor and one mode bit. Two zero-page gates decide which regime is in
 * force: loc_117 (the spinner-pot bit4 flag, set each heartbeat) and loc_3d (the active level/slot seat).
 * This routine collapses those two gates into the projection-scale cell (VG_SCALE, loc_b4) and bit 2 of
 * the vector-mode flag (VG_MODE_FLAG, loc_a1), so subsequent draws project at the right depth. It is
 * called at the head of the well/object draws and by the level and sound setups.
 *
 * Behavior: default to value 0x00 with scale 0x10. Only when BOTH gates are non-zero switch to the
 * alternate value 0x04 with scale 0x08. Then copy just bit 2 of the chosen value into VG_MODE_FLAG while
 * preserving every other bit (the ((a^cur)&0x04)^cur idiom is a masked bit-merge), and store the scale
 * into VG_SCALE.
 *
 * Live-out: VG_MODE_FLAG (bit 2 updated, other bits kept) and VG_SCALE (whole byte). No registers.
 *
 * Grounding: [seen]
 */
export function selectProjectionScale(m) {
  const { mem8 } = m;
  // Default regime: mode-bit source 0x00, scale 0x10.
  let a = 0x00, y = 0x10;
  // Both gates open (spinner bit4 set AND a live seat) selects the alternate pair 0x04 / 0x08.
  if (mem8[loc_117] !== 0 && mem8[loc_3d] !== 0) {
    a = 0x04;
    y = 0x08;
  }
  // Masked bit-merge: copy only bit 2 of the chosen value into the flag, leaving the rest of loc_a1 intact.
  const cur = mem8[VG_MODE_FLAG];
  mem8[VG_MODE_FLAG] = ((((a ^ cur) & 0x04) ^ cur));
  // Publish the projection scale for the depth math.
  mem8[VG_SCALE] = y;
}
