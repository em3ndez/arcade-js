// SPDX-License-Identifier: GPL-3.0-only
/**
 * requestSound19 — ask the sound driver to play sound-command 19.  ROM 0x4c9b.
 *
 * One of a fan of ~20 tiny sound-trigger stubs, each hard-wired to a single sound-
 * command index and sharing one enqueue tail. This one requests command 19: it hands
 * that index to the shared sound-ring enqueue, which marks it pending (high bit) and
 * drops it into the next free slot of the 8-slot sound ring for the driver to drain
 * later. The index is the stub's whole identity — its siblings are byte-for-byte
 * identical apart from which number they request (18 sits just below it, 20 just above).
 *
 * Which real effect command 19 selects is not yet identified, so the name states the
 * command it requests, not the noise that plays. Once the command is queued there is
 * nothing left to do — the enqueue returns straight to this stub's own caller.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4c9b.test.js.
 * GATE:     crafted-entry — attract never requests command 19, so the gate runs this
 *           stub from a real captured sound-request state (a sibling stub's entry) and
 *           sweeps every ring write pointer 0..7 identically on both sides; teeth catch
 *           a wrong-command twin and a dropped pending bit.
 * LIVE-OUT: memory-only — the filled ring slot (SOUND_RING) and the advanced write
 *           pointer (SOUND_HEAD), both written by the shared enqueue. No register or
 *           flag is live out; the command byte and flags the oracle path leaves behind
 *           are dead scratch, as are the register pairs it parks on the stack.
 * NAMES:    none of its own — delegates to enqueueSoundCommand, which owns
 *           SOUND_HEAD / SOUND_RING (from names.js).
 */
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

export function requestSound19(m) {
  // Queue sound command 19; the shared enqueue sets the pending bit and files it in
  // the next ring slot.
  enqueueSoundCommand(m, 19);
}
