// SPDX-License-Identifier: GPL-3.0-only
import { loc_41d1, loc_41d2, loc_41d6, SOUND_SEQ_PTR, loc_1e68 } from "./names.js";

/**
 * armSoundSequenceOnRequest — arm one melodic sound-sequence channel when its request gate is raised.
 *
 * WHAT IT IS
 *   A gated one-shot arm for a sequence channel. It fires only when request gate loc_41d1 (0x41d1)
 *   holds exactly 1; then it consumes the gate and starts the channel. Any other gate value is a
 *   no-op that leaves the byte untouched.
 *
 * ROLE IN THE MACHINE
 *   Galaxian's three sequence channels share a single playback state (tone, duration timer, cursor);
 *   only each channel's flag byte is per-channel. Arming a channel means: raise its flag, prime the
 *   shared duration timer loc_41d6 (0x41d6) to 1 so the next tick immediately fetches a note, and point
 *   the shared cursor SOUND_SEQ_PTR (0x41d3) at this sequence's data table. Here that table is loc_1e68,
 *   and this channel's flag is loc_41d2 (0x41d2). The gate loc_41d1 is seeded by game events (e.g. set
 *   to 1 at round start by startGameRoundAndClearScores); advanceAllSoundSequenceChannels then plays the
 *   armed channel out via advanceSoundSequenceChannel one tick per frame.
 *
 * ROM 0x1747.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: on an arm, loc_41d1 = 0, loc_41d2 = 1, loc_41d6 = 1, SOUND_SEQ_PTR = loc_1e68. Otherwise
 * nothing changes.
 */

// The one value the request gate must hold for the sequence to arm.
const ARM_REQUESTED = 1;

export function armSoundSequenceOnRequest(m) {
  const { mem8, mem16 } = m;

  // Gate: arm only on an outstanding request (gate == 1); any other value returns untouched.
  if (mem8[loc_41d1] !== ARM_REQUESTED) return;

  // Consume the request so this fires once, then arm the channel:
  mem8[loc_41d1] = 0;
  // raise this channel's active flag,
  mem8[loc_41d2] = 1;
  // prime the shared duration timer to 1 so the next tick fetches the first note,
  mem8[loc_41d6] = 1;
  // and point the shared playback cursor at this sequence's data table (loc_1e68).
  mem16[SOUND_SEQ_PTR] = loc_1e68;
}
