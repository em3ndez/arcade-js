// SPDX-License-Identifier: GPL-3.0-only
/** requestEnemyLaunchSoundLateEra — request one particular sound, and only while a game is in progress. Its code is
 * fetched from a byte of the program image. LIVE-OUT: memory.
 *
 * ROM 0x5669-0x566D (frozen lift loc_5669). Grounding: [seen] (names.js ROUTINES 0x5669).
 *
 * Role in the machine: the late-era variant of the enemy-launch sound. Its one caller,
 * requestEraKeyedLaunchSound, sends here once ERA_INDEX has reached 3 and to the early-era
 * sibling requestEnemyLaunchSound below that, so the launch sound changes in the later eras.
 *
 * The code is ENEMY_LAUNCH_SOUND_LATE_ERA (0x4C9F), a byte of the program ROM read as data, not
 * an immediate operand. It goes through enqueueSoundIfGameInProgress, so it is queued only while
 * PLAY_ACTIVE is set.
 */

import { enqueueSoundIfGameInProgress } from "./enqueueSoundIfGameInProgress.js";
import { ENEMY_LAUNCH_SOUND_LATE_ERA } from "./names.js";

export function requestEnemyLaunchSoundLateEra(m) {
  /* ld a,(0x4c9f) / jr 0x560c: fetch the code and jump (nothing pushed) into the in-play gate,
   * whose return goes straight back to our caller. */
  enqueueSoundIfGameInProgress(m, m.mem8[ENEMY_LAUNCH_SOUND_LATE_ERA]);
}
