// SPDX-License-Identifier: GPL-3.0-only
import { loc_00, TILEMAP_PTR_LO, loc_40, loc_70, loc_ef } from "./names.js";
import { seedWaveState } from "./seedWaveState.js";
import { resolveTileCellAtXY } from "./resolveTileCellAtXY.js";

/**
 * advanceHeadOrientation — the centipede head's orientation/steer routine (two entry points sharing
 * one body).
 *
 * guardHeadOrientationWrap — the wrap guard. The caller hands the head's folded orientation byte in A;
 *   unfold it and, once it reaches the top of its range (>= 0xfa), return; otherwise re-seed the wave
 *   state (a fresh heading/velocity).
 *
 * advanceHeadOrientationAndStampTile — the per-tick step. Every 4th tick, rotate the head's orientation
 *   by one of four values (folded through the XOR mask), resolve the tile the head faces, and — only when
 *   that cell reads in the band [0x3c, 0x40) — stamp a masked marker (cell & 0xfb) back into it.
 */
export function guardHeadOrientationWrap(m, a = m.regs.a) {
  // Unfold the orientation byte the caller forwarded in A.
  const value = (a ^ m.mem8[loc_ef]) & 0xff;
  if (value >= 0xfa) return (m.regs.a = value);
  return seedWaveState(m);
}

export function advanceHeadOrientationAndStampTile(m) {
  const { mem8, mem16 } = m;

  // Every 4th tick, rotate the orientation by one (mod 4), re-fold into 0x30..0x33.
  if ((mem8[loc_00] & 0x03) === 0) {
    mem8[loc_40] = (((mem8[loc_40] + 1) & 0x03) | 0x30) ^ mem8[loc_ef];
  }

  // Resolve the tile the head faces.
  const [cell] = resolveTileCellAtXY(m, mem8[loc_70], 0x00);
  // Only stamp when the cell sits in the band [0x3c, 0x40).
  if (cell >= 0x40) return;
  if (cell < 0x3c) return;
  // Stamp the masked marker (cell & 0xfb) back into the tile cell.
  const marker = ((cell & 0xfb) ^ mem8[loc_ef]) & 0xff;
  mem8[mem16[TILEMAP_PTR_LO]] = marker;
  return (m.regs.a = marker);
}
