// SPDX-License-Identifier: GPL-3.0-only
//
// advanceSoundSequenceChannel (ROM 0x176c, [seen]) -- one frame of one melodic sound-sequence channel.
//
// WHAT IT IS
//   The shared per-channel worker behind Galaxian's three melodic sound sequences (the tune-like cues).
//   advanceAllSoundSequenceChannels (ROM 0x175d) calls it once per frame on each of the three channel
//   descriptors (loc_41d2, loc_41cf, SOUND_SEQ_ACTIVE) in turn. descPtr selects which channel; the tone,
//   duration, and playback cursor cells it reads/writes (loc_41d5, loc_41d6, SOUND_SEQ_PTR) are a single
//   shared playback state that this worker drives on behalf of the descriptor. (mechanisms.md, "The
//   melodic sequence channels".)
//
// ROLE IN THE MACHINE
//   A descriptor byte of 0 means the channel is inactive -- nothing to do. When active, each frame it
//   re-publishes the current tone loc_41d5 into SOUND_PITCH (0x41c1, the staged-pitch shadow the driver
//   latches out) and stamps the composite sound flag loc_41c0 = 2 (marking "a sequence spoke this
//   frame"), then ticks the tone's duration timer loc_41d6. While the timer is still running there is
//   nothing more to do. When it expires, it fetches the next command byte from the shared cursor
//   SOUND_SEQ_PTR: 0xe0 is an end marker that deactivates the channel; any other byte is split into a
//   low-5-bit index into SOUND_TONE_TABLE (0x17a9) for the new tone and a high-3-bit index into
//   SOUND_DURATION_TABLE (0x17c8) for the new duration timer, and the cursor advances past it.
//
// LIVE-OUT: loc_41c0, SOUND_PITCH, loc_41d5, loc_41d6, SOUND_SEQ_PTR, and descPtr's descriptor byte.
import {
  SOUND_PITCH, SOUND_SEQ_PTR,
  SOUND_TONE_TABLE, SOUND_DURATION_TABLE,
  loc_41c0, loc_41d5, loc_41d6,
} from "./names.js";

const SEQ_END = 0xe0; // command byte that terminates a channel

export function advanceSoundSequenceChannel(m, descPtr = m.regs.hl) {
  const { mem8, mem16 } = m;

  // Inactive descriptor (byte 0): this channel is silent, so do nothing this frame.
  if (mem8[descPtr] === 0) return; // channel inactive

  // Active: stamp the composite flag (2 = "a sequence channel spoke") and publish the current tone into
  // the staged-pitch shadow so the driver latches it out later this frame.
  mem8[loc_41c0] = 2;
  mem8[SOUND_PITCH] = mem8[loc_41d5]; // publish the current tone to the output shadow

  // Tick the current tone's duration timer. While it is still counting down, hold this tone and return.
  const timer = (mem8[loc_41d6] - 1) & 0xff;
  if (timer !== 0) { mem8[loc_41d6] = timer; return; } // still counting down

  // Timer expired: read the next command byte from the shared playback cursor.
  const cursor = mem16[SOUND_SEQ_PTR];
  const cmd = mem8[cursor];
  // End marker (0xe0): the sequence is over, so deactivate this channel and stop.
  if (cmd === SEQ_END) { mem8[descPtr] = 0; return; } // end marker deactivates the channel

  // Otherwise decode the command: advance the cursor past it, then split its bits into a new tone (low 5
  // bits -> tone table) and a new duration timer (high 3 bits -> duration table).
  mem16[SOUND_SEQ_PTR] = cursor + 1; // consume the command byte
  mem8[loc_41d5] = mem8[SOUND_TONE_TABLE + (cmd & 0x1f)]; // low 5 bits -> new tone
  mem8[loc_41d6] = mem8[SOUND_DURATION_TABLE + (cmd >> 5)]; // high 3 bits -> new duration timer
}
