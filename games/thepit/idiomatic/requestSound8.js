// SPDX-License-Identifier: GPL-3.0-only
/**
 * requestSound8 — ask the sound driver to play sound-command 8.  ROM 0x4c6f.
 *
 * One of a fan of ~20 tiny sound-trigger stubs, each hard-wired to a single sound-
 * command index. This one requests command 8: it hands that index to the shared
 * sound-ring enqueue, which marks it pending and drops it into the next free ring
 * slot for the sound driver to pick up later. The index is the stub's whole payload —
 * its immediate neighbours request 7 and 9, and every sibling is otherwise identical.
 *
 * Which real effect command 8 selects is not yet identified, so the name states the
 * command it requests, not the noise that plays.
 *
 * Since the enqueue queues the command and then returns straight to this stub's own
 * caller, there is nothing left to do once it is filed: hand off command 8 and return.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4c6f.test.js.
 * GATE:     crafted-entry — attract never requests command 8, so the gate runs this
 *           stub from a real captured sound-request state (a sibling stub's entry) and
 *           sweeps every ring write pointer 0..7 identically on both sides, pinning the
 *           7 -> 0 wrap. Teeth catch a wrong-command twin and a missing-pending-bit twin.
 * LIVE-OUT: memory-only — the filled ring slot and the advanced write pointer, both
 *           written by the shared enqueue. The oracle's exit registers, flags, and Z80
 *           return path (SP/PC) are dead scratch a plain JS call replaces.
 * NAMES:    none directly — delegates to enqueueSoundCommand, which owns the ring
 *           addresses (SOUND_HEAD, SOUND_RING).
 */
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

export function requestSound8(m) {
  // Queue sound command 8; the shared enqueue marks it pending, fills the ring slot,
  // and advances the write pointer to the next of the eight slots.
  enqueueSoundCommand(m, 8);
}
