// SPDX-License-Identifier: GPL-3.0-only
// Run one channel-updater step over the three sound-sequence descriptors in turn.
import { advanceSoundSequenceChannel } from "./advanceSoundSequenceChannel.js";
import { loc_41d2, loc_41cf, SOUND_SEQ_ACTIVE } from "./names.js";

export function loc_175d(m) {
  advanceSoundSequenceChannel(m, loc_41d2);
  advanceSoundSequenceChannel(m, loc_41cf);
  advanceSoundSequenceChannel(m, SOUND_SEQ_ACTIVE);
}
