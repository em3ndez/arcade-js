// SPDX-License-Identifier: GPL-3.0-only
/** requestPlayerShotSound — request one sound, admitted while a game runs or the cabinet may sound in attract.
 * Its code is fetched from a byte of the program image. LIVE-OUT: memory. */

import { enqueueSoundIfGameOrAttract } from "./enqueueSoundIfGameOrAttract.js";
import { loc_3270 } from "./names.js";

export function requestPlayerShotSound(m) {
  enqueueSoundIfGameOrAttract(m, m.mem8[loc_3270]);
}
