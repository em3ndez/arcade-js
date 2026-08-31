// SPDX-License-Identifier: GPL-3.0-only
import { sendSoundCommand } from "./sendSoundCommand.js";
import { SOUND_RING_READ_PTR, HIGH_SCORE_TABLE, DEMO_SOUNDS_DSW, GAME_ACTIVE_FLAG } from "./names.js";
/**
 * drainSoundCommandRing — consume ONE command from the sound-command ring buffer.
 *
 * WHAT IT IS
 *   The main CPU never talks to the audio processor directly during a frame. Instead, any code
 *   that wants a sound effect appends a one-byte command into a small circular queue — the
 *   sound-command ring — and lets a single consumer forward those bytes to the audio side at a
 *   steady rate. This routine is that consumer: it drains exactly one queued command per call.
 *
 * ROLE IN THE MACHINE
 *   Called once per frame as part of the per-frame sound service (right after the coin/credit
 *   service). Producers enqueue command bytes at the ring's write/tail cursor
 *   SOUND_RING_WRITE_PTR (0x8a40); this routine reads the slot under the read/head cursor
 *   SOUND_RING_READ_PTR (0x8a41). Because it pulls only one entry per beat, a burst of effects
 *   queued in a single frame is metered out to the audio CPU one-per-frame rather than all at once.
 *
 * THE RING
 *   The ring is a 28-slot circular buffer living in the tail of the 0x8a00 work-RAM page: its slots
 *   are the low-byte indices 0x43..0x5e (RING_HEAD_FIRST..RING_HEAD_LAST), i.e. absolute addresses
 *   0x8a43..0x8a5e. Each slot holds either a queued command byte or the empty marker 0xff.
 *
 * ROM 0x0e64-0x0e8e   grounding: [seen]
 *
 * LIVE-OUT: memory only — the consumed slot is freed (set to 0xff) and the head cursor is advanced
 *   (wrapping the last slot back to the first). No register result; callers discard everything else.
 */

// The head cursor sweeps the slot indices 0x43..0x5e (28 slots) as low-byte offsets into the 0x8a00
// page; advancing past the last slot wraps back to the first.
const RING_HEAD_LAST = 0x5e; //  last slot index in the ring
const RING_HEAD_FIRST = 0x43; // first slot index in the ring

// 0xff marks a slot as carrying no command. It is both the "nothing queued" test value and the
// value written back to release a slot once its command has been consumed.
const SLOT_EMPTY = 0xff;

// Bit 0 of the demo-sounds DIP cell: when set, queued sounds are still forwarded while the machine
// sits on the attract/idle screens.
const DEMO_SOUNDS_BIT = 0x01;

export function drainSoundCommandRing(m) {
  const { mem8 } = m;

  // Look at the slot under the read/head cursor. HIGH_SCORE_TABLE (0x8a00) is the base of the page
  // the ring shares; adding the head index (0x43..0x5e) lands on the current slot (0x8a43..0x8a5e).
  const head = mem8[SOUND_RING_READ_PTR];
  const slot = HIGH_SCORE_TABLE + head;
  const entry = mem8[slot];
  if (entry === SLOT_EMPTY) return; // head slot empty -> no command queued this beat, do nothing

  // Decide whether the machine should make any sound at all. It stays silent ONLY when BOTH gates
  // say idle-and-muted: the attract-sound DIP bit is clear AND no game is in progress
  // (GAME_ACTIVE_FLAG 0x8806 == 0). During play the sound always goes out; on the attract screens it
  // goes out only if the operator enabled demo sounds.
  const silent = (mem8[DEMO_SOUNDS_DSW] & DEMO_SOUNDS_BIT) === 0 && mem8[GAME_ACTIVE_FLAG] === 0;
  if (!silent) sendSoundCommand(m, entry); // forward the byte to the audio CPU (which pulses its IRQ)

  // Release the slot back to the producers and step the head one forward, wrapping the last slot
  // (0x5e) around to the first (0x43) so the cursor keeps circling the ring.
  mem8[slot] = SLOT_EMPTY; // free the consumed slot
  mem8[SOUND_RING_READ_PTR] = head === RING_HEAD_LAST ? RING_HEAD_FIRST : head + 1;
}
