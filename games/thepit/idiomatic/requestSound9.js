// SPDX-License-Identifier: GPL-3.0-only
/**
 * requestSound9 — ask the sound driver to play sound-command 9.  ROM 0x4c73.
 *
 * One of a fan of ~20 tiny sound-trigger stubs, each hard-wired to a single sound-
 * command index. This one requests command 9: it hands that index to the shared
 * sound-ring enqueue, which marks it pending (high bit) and drops it into the next
 * free slot of the 8-slot sound ring for the sound driver to drain later. The index
 * is the stub's whole payload — its siblings request 8 and 10 from the neighbouring
 * addresses.
 *
 * Which real effect command 9 selects is not yet identified, so the name states the
 * command it requests, not the noise that plays.
 *
 * The enqueue runs and then returns straight to this stub's own caller, so there is
 * nothing to do after queueing: hand off command 9 and return.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4c73.test.js.
 * GATE:     crafted-entry — attract never requests command 9, so the gate runs this
 *           stub from a real captured sound-request state (a sibling stub's entry) and
 *           sweeps every ring write pointer 0..7 identically on both sides; teeth catch
 *           a wrong-command twin and a dropped-pending-bit twin.
 * LIVE-OUT: memory-only — the filled ring slot (SOUND_RING) and the advanced write
 *           pointer (SOUND_HEAD), both written by the shared enqueue. The oracle's exit
 *           registers, flags, and Z80 return path (SP/PC) are dead scratch a plain JS
 *           call replaces.
 * NAMES:    none directly — delegates to enqueueSoundCommand, which owns the ring
 *           addresses (SOUND_HEAD, SOUND_RING).
 */
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

export function requestSound9(m) {
  // Queue sound command 9; the shared enqueue fills the ring slot and advances the pointer.
  enqueueSoundCommand(m, 9);
}
