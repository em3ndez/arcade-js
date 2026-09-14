// SPDX-License-Identifier: GPL-3.0-only

/**
 * noRebuildRequestReturn — the do-nothing tail. ROM 0xac07.
 *
 * Role in the machine: the fall-through exit of the control-block rebuild path.
 * rebuildControlBlocksIfRequested tests the rebuild-request bit in $1c9; when the bit
 * is clear there is no work to do this frame, and control lands here. This is the ROM's
 * "nothing requested" branch target, kept as its own routine so the dispatcher has a
 * concrete address to return through.
 *
 * Behavior: does nothing and returns immediately. It reads and writes no cells.
 *
 * Live-out: nothing. Grounding: [seen].
 */
export function noRebuildRequestReturn() {}
