// SPDX-License-Identifier: GPL-3.0-only
//
// repaintPlayerStatusColumnIfSaved -- ROM 0x20a7, grounding [seen].
//
// WHAT IT IS
//   A guarded wrapper around the player-status repaint: it repaints the status column only when the
//   saved status byte loc_40ab (0x40ab) is nonzero; a zero saved byte returns without touching VRAM.
//
// ROLE IN THE MACHINE
//   loc_40ab is set by repaintPlayerStatusColumnFromModeGate when the mode gate goes nonzero. On the
//   later frames where the gate is zero, this guard lets a repaint still happen (so the column keeps
//   showing) as long as a previous frame latched the request, and suppresses it once nothing is pending.
//
// LIVE-OUT: the status-column VRAM cells via the repaint tail (only when loc_40ab is nonzero).
import { repaintPlayerStatusColumn } from "./repaintPlayerStatusColumn.js";
import { loc_40ab } from "./names.js";

export function repaintPlayerStatusColumnIfSaved(m) {
  const { mem8 } = m;

  // Guard on the saved status byte: zero means no pending status request, so skip the repaint entirely.
  if (mem8[loc_40ab] === 0) return;

  // A prior frame latched a request -> repaint the current player's status column.
  return repaintPlayerStatusColumn(m);
}
