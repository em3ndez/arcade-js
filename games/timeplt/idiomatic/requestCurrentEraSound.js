// SPDX-License-Identifier: GPL-3.0-only
/** requestCurrentEraSound — request the sound that belongs to the era now being played, and only while a game
 * is in progress. It does not ask for a fixed sound: the era index picks one of a contiguous run
 * of codes beginning at a fixed offset, so each era gets its own. LIVE-OUT: memory.
 *
 * ROM 0x57F7-0x57FE (frozen lift loc_57f7). Grounding: [seen] (names.js ROUTINES 0x57F7).
 *
 * Role in the machine: its one caller is loc_43f0, which tail-calls it on the path that
 * activates the Mother-Ship (state byte set to 0xFF), so the sound heard when the Mother-Ship
 * appears differs by era.
 *
 * ERA_INDEX (0xAD04) [seen] holds the era being played, 0-4, so the codes asked for run from 12
 * to 16. names.js records that the sum is not clamped: the ROM adds without any range check.
 * The request goes through enqueueSoundIfGameInProgress, so it is queued only while PLAY_ACTIVE is
 * set.
 */

import { enqueueSoundIfGameInProgress } from "./enqueueSoundIfGameInProgress.js";
import { ERA_INDEX } from "./names.js";
import { u8 } from "../../../core/int.js";

/* The add a,0x0c at 0x57FA: era 0's code; each later era's is one higher. */
const FIRST_ERA_CODE = 12;

export function requestCurrentEraSound(m) {
  /* ld a,(0xad04) / add a,0x0c / jp 0x560c: the era plus the base, kept to a byte as the Z80
   * accumulator would, tail-jumped into the in-play gate. */
  enqueueSoundIfGameInProgress(m, u8(m.mem8[ERA_INDEX] + FIRST_ERA_CODE));
}
