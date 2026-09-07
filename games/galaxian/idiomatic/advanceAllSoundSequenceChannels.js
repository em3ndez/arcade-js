// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceAllSoundSequenceChannels (ROM 0x175d) -- step all three melodic sound-sequence
 * channels forward one tick this frame.
 *
 * WHAT IT IS
 *   Galaxian plays its scripted note sequences (the tunes and jingles) on three voice channels.
 *   This routine is the per-frame fan-out that advances every channel by one step: it calls the
 *   shared per-channel worker advanceSoundSequenceChannel once for each of the three sequence
 *   descriptors, in a fixed order.
 *
 * ROLE IN THE MACHINE
 *   Runs once per frame as one of the seven voice updaters driveSoundFrame invokes in a fixed
 *   order (mechanisms.md, "The melodic sequence channels"). The three descriptors are the flag
 *   bytes loc_41d2 (0x41d2), loc_41cf (0x41cf), and SOUND_SEQ_ACTIVE (0x41cd). Only that flag
 *   byte is per-channel; the tone (loc_41d5), duration timer (loc_41d6), and playback cursor
 *   (SOUND_SEQ_PTR) are a single shared playback state the worker hardwires and drives on behalf
 *   of whichever channel is active. An inactive descriptor (flag byte zero) is skipped entirely
 *   inside the worker, so this fan-out is safe to call unconditionally every frame.
 *
 * Grounding: [seen] (names.js cert for 0x175d).
 *
 * LIVE-OUT: none of its own -- the effects are whatever advanceSoundSequenceChannel leaves on the
 *   shared playback state (loc_41d5/loc_41d6/SOUND_SEQ_PTR) and the composite/pitch shadows.
 */
import { advanceSoundSequenceChannel } from "./advanceSoundSequenceChannel.js";
import { loc_41d2, loc_41cf, SOUND_SEQ_ACTIVE } from "./names.js";

export function advanceAllSoundSequenceChannels(m) {
  // Channel whose flag lives at loc_41d2 (0x41d2). The worker no-ops if this flag is zero.
  advanceSoundSequenceChannel(m, loc_41d2);
  // Channel whose flag lives at loc_41cf (0x41cf) -- the one armSoundSequenceBySelector raises on
  // selector 6 (points the shared cursor at loc_1ebd).
  advanceSoundSequenceChannel(m, loc_41cf);
  // Channel whose flag is SOUND_SEQ_ACTIVE (0x41cd) -- the one armSoundSequenceForSelector16 raises
  // on selector 0x16 (points the shared cursor at loc_1edf). Run last so its pitch wins ties this frame.
  advanceSoundSequenceChannel(m, SOUND_SEQ_ACTIVE);
}
