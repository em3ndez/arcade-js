// SPDX-License-Identifier: GPL-3.0-only
import { enqueueSoundCommandRing } from "./enqueueSoundCommandRing.js";
/**
 * queueSoundCommand05 — enqueue the fixed sound-effect command 0x05 into the
 * sound-command ring. [seen]
 *
 * ROM 0x0ef1-0x0ef5.
 *
 * WHAT IT IS
 * ----------
 * One of a large family of tiny "sound selector" entry points. The main CPU never
 * drives the audio hardware directly; it accumulates sound requests in a small
 * circular queue in shared work RAM and pays out exactly one per frame to the audio
 * processor. Each distinct effect gets its own selector routine that knows a single
 * command byte and does nothing more than append that byte to the queue. This one
 * stands for command byte 0x05.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * Game logic requests a sound by calling the matching selector rather than touching
 * the queue itself. This selector uses the unconditional append helper, so it queues
 * 0x05 regardless of game state. It is reached, for example, when a fired shot is
 * scanned against the enemy records and finds no record to strike (and the active
 * object type is not the special value 3): the miss queues this effect and the caller
 * continues normally.
 *
 * LIVE-OUT: memory only (ring slot + advanced write pointer). The helper leaves an
 * internal pointer in A, but enqueue sites reload A, so it is not a consumed live-out.
 */
// The one command byte this entry point exists to queue. The audio processor
// interprets 0x05 as its corresponding effect when the queue drains this slot.
const SOUND_COMMAND = 0x05;

export function queueSoundCommand05(m) {
  // Hand the fixed command byte to the ring-enqueue helper: it drops 0x05 into the
  // slot named by the write pointer and advances that pointer (wrapping the last
  // slot back to the first). The append is unconditional — the byte is always queued.
  return enqueueSoundCommandRing(m, SOUND_COMMAND);
}
