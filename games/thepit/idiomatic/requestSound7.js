// SPDX-License-Identifier: GPL-3.0-only
/**
 * requestSound7 — ask the sound driver to play sound-command 7.  ROM 0x4c6b.
 *
 * One of a fan of ~20 tiny sound-trigger stubs, each hard-wired to a single sound-
 * command index. This one requests command 7: it hands that index to the shared
 * sound-ring enqueue, which marks it pending (sets the high bit) and drops it into
 * the next free slot of the 8-slot sound ring for the driver to drain later. The
 * index is the stub's whole identity — its neighbours request 6 and 8 from the
 * addresses on either side, and are otherwise byte-for-byte the same.
 *
 * The shared enqueue runs and then returns straight to this stub's own caller, so
 * there is nothing to do once the command is queued: hand off command 7 and return.
 * Which real effect command 7 selects is not yet identified, so the name records the
 * command it requests, not the noise that plays.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4c6b.test.js.
 * GATE:     crafted-entry — attract never requests command 7, so the gate captures a
 *           real machine state at a reachable proxy leaf (the tilemap calc, entered
 *           early in attract and never a caller of this stub) and runs the stub on it,
 *           sweeping the ring write pointer across all eight slots identically on both
 *           sides; contract RAM (outside the dead stack scratch) + pc + SP. Teeth: a
 *           twin that requests a real sibling's command (6) is caught at the ring slot.
 * LIVE-OUT: memory-only — the filled ring slot (SOUND_RING) and the advanced write
 *           pointer (SOUND_HEAD), both written by the shared enqueue. The command byte
 *           and flags the oracle path leaves in registers are dead scratch no caller
 *           reads, as are the register pairs it parks on the stack.
 * NAMES:    none of its own — delegates to enqueueSoundCommand, which owns
 *           SOUND_HEAD / SOUND_RING (from ram.js).
 */
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

export function requestSound7(m) {
  // Queue sound command 7; the shared enqueue sets the pending bit and files it in
  // the next ring slot, wrapping the write pointer after the eighth slot.
  enqueueSoundCommand(m, 7);
}
