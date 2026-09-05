// SPDX-License-Identifier: GPL-3.0-only
// Sound-driver sequence tick: runs only when the driver-enable bit is set. A selector other than 6
// is handed to the selector-dispatch arm; selector 6 arms this sequence (unless already active) by
// raising its flags and publishing its data pointer.
import { loc_4006, loc_41df, SOUND_SEQ_ACTIVE, loc_41cf, loc_41d6, SOUND_SEQ_PTR, loc_1ebd } from "./names.js";
import { armSoundSequenceForSelector16 } from "./armSoundSequenceForSelector16.js";

const SELECTOR_6 = 6;

export function loc_1819(m) {
  const { mem8, mem16 } = m;

  // Gate: driver disabled -> nothing to do.
  if (!(mem8[loc_4006] & 1)) return;

  const selector = mem8[loc_41df];
  if (selector !== SELECTOR_6) return armSoundSequenceForSelector16(m, selector);

  // Selector 6: skip if this sequence is already active, else arm it.
  if (mem8[SOUND_SEQ_ACTIVE] & 1) return;
  mem8[loc_41cf] = 1;
  mem8[loc_41d6] = 1;
  mem16[SOUND_SEQ_PTR] = loc_1ebd;
}
