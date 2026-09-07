// SPDX-License-Identifier: GPL-3.0-only
//
// repaintPlayerStatusColumnFromModeGate -- ROM 0x209c, grounding [seen].
//
// WHAT IT IS
//   The mode-gated entry to the player-status repaint. It latches the mode gate byte into a saved
//   status byte and repaints, or falls back to the "repaint only if already saved" path when the gate
//   is zero.
//
// ROLE IN THE MACHINE
//   loc_4006 (0x4006) is the mode gate; loc_40ab (0x40ab) is the saved status byte that the repaint
//   wrappers consult. When the gate is nonzero the display is meant to show the status column, so we
//   remember that by copying the gate into loc_40ab and repaint now; when the gate is zero we do not
//   force a repaint but honour a previously-saved request via repaintPlayerStatusColumnIfSaved. This is
//   the form the idle object-figure draw head (drawObjectFigureGridColumn 0x2067) calls on FRAME_COUNTER
//   low-nibble phase 0, so the status column is kept fresh as background work.
//
// LIVE-OUT: loc_40ab (0x40ab) when the gate is nonzero; the status-column VRAM cells via the repaint tail.
import { loc_4006, loc_40ab } from "./names.js";
import { repaintPlayerStatusColumnIfSaved } from "./repaintPlayerStatusColumnIfSaved.js";
import { repaintPlayerStatusColumn } from "./repaintPlayerStatusColumn.js";

export function repaintPlayerStatusColumnFromModeGate(m) {
  const { mem8 } = m;

  // Read the mode gate. Zero means "no active request this mode": defer to the saved-byte path, which
  // repaints only if an earlier nonzero gate had already latched loc_40ab.
  const gate = mem8[loc_4006];
  if (gate === 0) return repaintPlayerStatusColumnIfSaved(m);

  // Nonzero gate: latch it into the saved status byte so later zero-gate frames still repaint, then
  // repaint the column now (default flags come from register B inside repaintPlayerStatusColumn).
  mem8[loc_40ab] = gate; // save the nonzero gate byte
  return repaintPlayerStatusColumn(m);
}
