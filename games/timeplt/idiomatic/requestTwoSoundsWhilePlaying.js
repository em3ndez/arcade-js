// SPDX-License-Identifier: GPL-3.0-only
/** requestTwoSoundsWhilePlaying — ask for two sounds in a row. This entry supplies the first code, fetched from a byte of the program
 * image rather than carried as an immediate, and leaves through the entry that supplies the second; both go in under
 * the same permission, so a state that refuses one drops the pair together. LIVE-OUT: memory. */

import { enqueueSoundIfGameInProgress } from "./enqueueSoundIfGameInProgress.js";
import { requestAttackerSpawnSoundLateEra } from "./requestAttackerSpawnSoundLateEra.js";
import { loc_07d8 } from "./names.js";

export function requestTwoSoundsWhilePlaying(m) {
  enqueueSoundIfGameInProgress(m, m.mem8[loc_07d8]);
  requestAttackerSpawnSoundLateEra(m);
}
