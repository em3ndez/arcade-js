// SPDX-License-Identifier: GPL-3.0-only
import { enqueueSoundCommandRing } from "./enqueueSoundCommandRing.js";
/**
 * queueSoundCommand02 — enqueue the fixed sound-effect command 0x02 into the sound-command ring.
 *
 * WHAT IT IS
 *   One of a family of tiny "sound selector" entry points. Each selector stands for a single
 *   fixed sound: it names one command byte and appends it to the queue that feeds the audio
 *   processor. This one always queues command id 0x02.
 *
 * ROLE IN THE MACHINE
 *   The main processor never synthesizes audio itself — a separate sound processor does that.
 *   To ask for a sound, game logic does not poke the audio hardware directly; it drops a
 *   one-byte request into a small circular queue in shared work RAM and moves on. Once per
 *   frame the machine drains one byte from that queue and hands it across to the sound
 *   processor. This selector is a producer for that queue: call it, and command 0x02 is
 *   pending for the next drain. It appends unconditionally — the byte is queued regardless of
 *   game state — so callers that need the sound guaranteed use this path rather than a
 *   state-gated one.
 *
 * ROM ADDRESS
 *   0x0ed6-0x0ed9. It loads the command byte and falls straight through into the shared
 *   ring-enqueue helper at 0x0eb3, whose return carries back to this selector's caller.
 *
 * GROUNDING
 *   [seen] — role confirmed by observation.
 *
 * LIVE-OUT
 *   None usable by the caller — memory only. The effect is the helper's two writes: command
 *   0x02 stored into the ring's tail slot, and the ring write pointer advanced one slot
 *   (wrapping the last slot back to the first). The accumulator is left holding an internal
 *   value from the store, but callers reload it, so it is not a consumed live-out.
 */

// The single fixed command id this selector stands for. It is the whole identity of the
// routine: everything else is the shared enqueue mechanism.
const SOUND_COMMAND = 0x02; // the sound-command id this wrapper enqueues

export function queueSoundCommand02(m) {
  // Hand the fixed command byte to the shared ring-enqueue mechanism, which stores it at the
  // queue's tail slot and bumps the write pointer with wraparound. There is no per-selector
  // logic beyond choosing the byte, so the enqueue result flows straight back to the caller.
  return enqueueSoundCommandRing(m, SOUND_COMMAND);
}
