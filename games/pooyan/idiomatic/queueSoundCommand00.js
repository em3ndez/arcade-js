// SPDX-License-Identifier: GPL-3.0-only
import { enqueueSoundCommandRing } from "./enqueueSoundCommandRing.js";
/**
 * queueSoundCommand00 — the "silence" sound selector. [seen]
 *
 * WHAT IT IS
 *   One of the small family of sound-command selectors. Each selector knows a single fixed
 *   command byte and appends it to the sound-command ring; this one owns command 0x00, the
 *   code that tells the audio processor to fall silent. It takes no argument and makes no
 *   decision — calling it always means "queue silence."
 *
 * ROLE IN THE MACHINE
 *   The main CPU never synthesizes audio; it hands one-byte requests to a separate sound
 *   processor. To avoid latching a chip write the instant every game event fires, producers
 *   accumulate their requests in a small circular buffer (the sound-command ring), and the
 *   per-frame service loop pays out one queued byte to the audio hardware each frame. This
 *   selector is a producer for that ring: game code that wants silence calls here rather than
 *   touching the buffer or the audio latch itself.
 *
 *   It uses the plain, unconditional enqueue helper — silence must be queued no matter what
 *   the game state is (there is no "only while a game is running" gate on cutting the sound),
 *   which is exactly the class of request the unconditional appender exists to serve.
 *
 * ROM 0x0ecf. A pure selector: it names the constant and delegates; it touches nothing else.
 *
 * LIVE-OUT: memory only — whatever the ring append leaves behind (the newly filled slot plus
 * the advanced write pointer). It returns no value and leaves nothing useful in a register;
 * the queued byte is a compile-time constant, so there is no computed result to hand back.
 */

// The fixed command byte this selector owns: 0x00, the audio processor's "silence" code.
// Naming it here is the selector's entire specialization — every other selector differs only
// in which constant it carries to the same ring.
const SOUND_CMD_SILENCE = 0x00;

export function queueSoundCommand00(m) {
  // Append the silence code to the tail of the sound-command ring (buffer at 0x8a43..0x8a5e,
  // write pointer SOUND_RING_WRITE_PTR at 0x8a40). The helper stores at the tail and advances
  // the write cursor with wraparound; the frame's ring drain later forwards this byte to the
  // audio processor. Unconditional: silence is queued regardless of game state.
  enqueueSoundCommandRing(m, SOUND_CMD_SILENCE);
}
