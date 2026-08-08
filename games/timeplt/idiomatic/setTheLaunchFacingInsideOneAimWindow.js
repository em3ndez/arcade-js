// SPDX-License-Identifier: GPL-3.0-only
/** setTheLaunchFacingInsideOneAimWindow — the last gate in front of a launch, and the one thing the launcher is told. On one of
 * the two coordinates the sprite entry carries, the launcher must lie inside a window centred on a
 * fixed line; the half-width is read from a cell rather than baked in, so it is a setting and not a
 * constant, and outside the window this entry ends and nothing is launched. Inside it the OTHER
 * coordinate is compared against a second fixed line, and which side it falls on is handed over in
 * the narrow scratch byte as a plain zero or one, which the launcher turns into a facing. Control
 * then leaves for it and does not come back. LIVE-OUT: memory, and that one byte. */

import { u8, u16 } from "../../../core/int.js";

const WINDOW_HALF_WIDTH = 0xa8e6;
const WINDOW_CENTRE = 0x84;
const FACING_LINE = 0x78;

const ENTRY_OTHER_COORD = 0x31;
const LAUNCHER = 0x42b7;

export function setTheLaunchFacingInsideOneAimWindow(m) {
  const { regs, mem8 } = m;
  const half = mem8[WINDOW_HALF_WIDTH];
  const intoWindow = u8(WINDOW_CENTRE - mem8[regs.iy] + half);
  if (intoWindow >= u8(half + half)) return;

  regs.c = mem8[u16(regs.iy + ENTRY_OTHER_COORD)] > FACING_LINE ? 1 : 0;
  return m.call(LAUNCHER);
}
