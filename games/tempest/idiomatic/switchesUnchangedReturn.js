// SPDX-License-Identifier: GPL-3.0-only

/**
 * switchesUnchangedReturn -- shared no-op return tail. ROM 0xac3e.
 *
 * Role in the machine: Tempest re-reads its DIP/option snapshot every so often to notice an operator
 * changing a switch mid-game. requestRebuildIfSwitchesChanged (0xac20) decodes the live switches and
 * compares them against the cached targets; when nothing changed it falls straight through to this
 * label instead of raising the pending-rebuild request bits. This function IS that fall-through target:
 * a bare rts. It exists as a named routine only because the original ROM branched to a shared return
 * address, and the decompiler preserves that address as its own leaf.
 *
 * Behavior: does nothing and returns. Reads no cells, writes no cells, calls nothing.
 *
 * Live-out: none. Grounding: [seen].
 */
export function switchesUnchangedReturn() {}
