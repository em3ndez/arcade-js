// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommand0A — request sound effect 0x0a.
 *
 * WHAT IT IS
 *   One of a crowd of tiny, near-identical sound emitters (queueSoundCommand01 / 06 / 0A / 0D /
 *   0E / 0F / 11, ...). Each one stands for a single fixed sound: it carries one hard-coded
 *   command code and does nothing but hand that code to the shared append helper. This one owns
 *   command byte 0x0a.
 *
 * ITS ROLE IN THE MACHINE
 *   The audio hardware is a second, dedicated processor; the game CPU never drives it directly
 *   during play. Instead it speaks to the audio side through a small circular mailbox — the
 *   28-slot sound-command ring buffer in the 0x8a00 work page (write cursor SOUND_RING_WRITE_PTR
 *   0x8a40, read cursor SOUND_RING_READ_PTR 0x8a41, slots SOUND_RING_BUFFER 0x8a43..0x8a5e).
 *   Gameplay code that wants a sound played calls one of these emitters, which drops the sound's
 *   command byte into the next free ring slot. Later, once per frame, the coin/sound service step
 *   of the main loop drains one byte from the ring and forwards it to the audio processor. So this
 *   routine is a producer at the very front of that pipeline: "make sound 0x0a happen, soon."
 *
 * ROM 0x0f05-0x0f08. [seen].
 *
 * LIVE-OUT
 *   A = the append helper's result: the advanced ring write cursor after the byte is enqueued, or
 *   0 when the enqueue was suppressed (see the gate below). The AF register pair is not preserved
 *   across this hand-off (unlike BC/DE/HL), so a caller may read this value back out of A.
 */

// The fixed command byte this emitter stands for. It is the only thing that distinguishes 0x0a
// from its sibling emitters; the ring-append machinery is entirely shared.
const COMMAND = 0x0a;

export function queueSoundCommand0A(m) {
  // Hand the fixed sound code to the shared gated append, which does all the real work: it stashes
  // the byte, then enqueues it into the ring ONLY while play is live (the in-play gate
  // GAME_ACTIVE_FLAG 0x8806 set, or the play-state latch PLAY_MODE_LATCH 0x8f50 nonzero) — during
  // attract or between lives the request is dropped so stray effects can't fire. Its result (the
  // advanced cursor, or 0 when suppressed) is passed straight back to our caller unchanged.
  return appendSoundCommandGated(m, COMMAND);
}
