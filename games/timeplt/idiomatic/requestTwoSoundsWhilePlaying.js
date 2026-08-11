// SPDX-License-Identifier: GPL-3.0-only
/** requestTwoSoundsWhilePlaying — ask for two sounds in a row. This entry supplies the first code, fetched from a byte of the program
 * image rather than carried as an immediate, and leaves through the entry that supplies the second; both go in under
 * the same permission, so a state that refuses one drops the pair together. LIVE-OUT: memory. */

import { loc_560c } from "./loc_560c.js";
import { requestAttackerSpawnSoundLateEra } from "./requestAttackerSpawnSoundLateEra.js";

const SOUND_CODE_CELL = 0x07d8;

export function requestTwoSoundsWhilePlaying(m) {
  loc_560c(m, m.mem8[SOUND_CODE_CELL]);
  requestAttackerSpawnSoundLateEra(m);
}
