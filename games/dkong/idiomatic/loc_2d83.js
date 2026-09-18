// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2d83 — restart the per-entry sprite emitter at the head of a fixed source sequence and emit
 * that sequence's first entry: hand the sequence head to the emitter as a cursor and stamp it into
 * RENDER_STR_PTR (which the emitter immediately advances past), then run the emitter once.
 *
 * LIVE-OUT: memory-only — the restarted RENDER_STR_PTR (immediately re-advanced) and the sprite
 * record the emitter lays down for the first entry.
 */

import { RENDER_STR_PTR } from "./names.js";
import { stepBarrelAlongReleasePath } from "./stepBarrelAlongReleasePath.js";

const STRING_START = 0x39cc;

export function loc_2d83(m) {
  const { mem16 } = m;

  mem16[RENDER_STR_PTR] = STRING_START;

  return stepBarrelAlongReleasePath(m, STRING_START);
}
