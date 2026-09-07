// SPDX-License-Identifier: GPL-3.0-only
import { loc_4006, loc_41df, SOUND_SEQ_ACTIVE, loc_41cf, loc_41d6, SOUND_SEQ_PTR, loc_1ebd } from "./names.js";
import { armSoundSequenceForSelector16 } from "./armSoundSequenceForSelector16.js";

/**
 * armSoundSequenceBySelector — per-frame arm of a melodic sequence channel, keyed off the shared
 * sound-request selector, gated on the sound driver being enabled.
 *
 * WHAT IT IS
 *   Reads the shared request selector loc_41df (0x41df) and decides which sequence channel to arm.
 *   Selector 6 arms this routine's own channel; any other value is handed to
 *   armSoundSequenceForSelector16 (which recognizes only 0x16). Runs only while the sound driver is on.
 *
 * ROLE IN THE MACHINE
 *   The selector loc_41df is the bridge from game events (object deaths, player input) to the sound
 *   sequencer. bit 0 of loc_4006 (0x4006) is the sound-driver enable — with it clear there is nothing
 *   to do. For selector 6 the channel is armed only if it is not already playing: SOUND_SEQ_ACTIVE
 *   (0x41cd) set means this sequence is live, so skip re-arming. Arming raises this channel's flags
 *   loc_41cf (0x41cf) and the shared duration timer loc_41d6 (0x41d6) to 1 (so the next tick fetches a
 *   note), and points the shared cursor SOUND_SEQ_PTR (0x41d3) at data table loc_1ebd. Any selector
 *   other than 6 falls through to armSoundSequenceForSelector16, whose only recognized value is 0x16.
 *
 * ROM 0x1819.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: on a selector-6 arm, loc_41cf = 1, loc_41d6 = 1, SOUND_SEQ_PTR = loc_1ebd. Driver-off or
 * already-active returns leave state unchanged; other selectors return armSoundSequenceForSelector16's
 * result.
 */

const SELECTOR_6 = 6;

export function armSoundSequenceBySelector(m) {
  const { mem8, mem16 } = m;

  // Gate: sound driver disabled (loc_4006 bit0 clear) -> nothing to do.
  if (!(mem8[loc_4006] & 1)) return;

  // Read the shared request selector; anything but 6 is another handler's job.
  const selector = mem8[loc_41df];
  if (selector !== SELECTOR_6) return armSoundSequenceForSelector16(m, selector);

  // Selector 6: skip if this sequence is already active (SOUND_SEQ_ACTIVE set), else arm it.
  if (mem8[SOUND_SEQ_ACTIVE] & 1) return;
  // Raise this channel's flag,
  mem8[loc_41cf] = 1;
  // prime the shared duration timer to 1 so the next tick fetches the first note,
  mem8[loc_41d6] = 1;
  // and point the shared playback cursor at this sequence's data table (loc_1ebd).
  mem16[SOUND_SEQ_PTR] = loc_1ebd;
}
