// SPDX-License-Identifier: GPL-3.0-only
/** loc_5634 — queue seven sound requests back to back. Six are fixed, and each is fetched from
 * its own cell of the program image rather than carried as an immediate, so an edit to the image
 * changes what is asked for; the seventh is formed by adding the era index to a fixed base, so
 * it is the one request that differs from era to era. Nothing here tests whether a game is being
 * played. LIVE-OUT: memory-only. */

import { enqueueSoundUnconditional } from "./enqueueSoundUnconditional.js";
import { ERA_INDEX } from "./names.js";
import { u8 } from "../../../core/int.js";

const FIXED_CODE_SOURCES = [0x167c, 0x0a9c, 0x1484, 0x0c78, 0x07d3, 0x33b4];
const ERA_CODE_BASE = 140;

export function loc_5634(m) {
  const { mem8 } = m;
  for (const source of FIXED_CODE_SOURCES) enqueueSoundUnconditional(m, mem8[source]);
  enqueueSoundUnconditional(m, u8(mem8[ERA_INDEX] + ERA_CODE_BASE));
}
