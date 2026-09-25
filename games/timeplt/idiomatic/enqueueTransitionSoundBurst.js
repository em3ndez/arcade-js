// SPDX-License-Identifier: GPL-3.0-only
/** enqueueTransitionSoundBurst — queue seven sound requests back to back. Six are fixed, and each is fetched from
 * its own cell of the program image rather than carried as an immediate, so an edit to the image
 * changes what is asked for; the seventh is formed by adding the era index to a fixed base, so
 * it is the one request that differs from era to era. Nothing here tests whether a game is being
 * played. LIVE-OUT: memory-only. */

import { enqueueSoundUnconditional } from "./enqueueSoundUnconditional.js";
import { ERA_INDEX, TRANSITION_SOUND_CODE_CELL_167C, TRANSITION_SOUND_CODE_CELL_1484, TRANSITION_SOUND_CODE_CELL_33B4 } from "./names.js";
import { u8 } from "../../../core/int.js";

const FIXED_CODE_SOURCES = [TRANSITION_SOUND_CODE_CELL_167C, 0xa9c, TRANSITION_SOUND_CODE_CELL_1484, 0xc78, 0x7d3, TRANSITION_SOUND_CODE_CELL_33B4];
const ERA_CODE_BASE = 140;

export function enqueueTransitionSoundBurst(m) {
  const { mem8 } = m;
  for (const source of FIXED_CODE_SOURCES) enqueueSoundUnconditional(m, mem8[source]);
  enqueueSoundUnconditional(m, u8(mem8[ERA_INDEX] + ERA_CODE_BASE));
}
