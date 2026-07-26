// SPDX-License-Identifier: GPL-3.0-only
/**
 * requestSound12 — ask the sound driver to play sound-command 12.  ROM 0x4c7f.
 *
 * One of a fan of ~20 tiny sound-trigger stubs, each hard-wired to a single sound-
 * command index. This one requests command 12: it hands that index to the shared
 * sound-ring enqueue, which drops it into the next free ring slot (marked pending)
 * for the sound driver to pick up later. The index is the stub's whole payload — its
 * neighbours at the adjacent addresses request command 11 and command 13.
 *
 * Which real effect command 12 selects is not yet identified, so the name states the
 * command it requests, not the noise that plays.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4c7f.test.js.
 * GATE:     crafted-entry — attract never requests command 12, so the gate runs this
 *           stub from a real captured sound-request state (a sibling stub's entry) and
 *           sweeps every ring write pointer 0..7 identically on both sides; teeth catch
 *           a wrong-command twin and a dropped pending bit.
 * LIVE-OUT: memory-only — the filled ring slot and the advanced write pointer, both
 *           written by the shared enqueue. The oracle's exit registers, flags, and Z80
 *           return path (SP/PC) are dead scratch a plain JS call replaces.
 * NAMES:    none directly — delegates to enqueueSoundCommand, which owns the ring
 *           addresses (SOUND_HEAD, SOUND_RING).
 */
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

export function requestSound12(m) {
  // Queue sound command 12; the shared enqueue fills the ring slot and advances the pointer.
  enqueueSoundCommand(m, 12);
}
