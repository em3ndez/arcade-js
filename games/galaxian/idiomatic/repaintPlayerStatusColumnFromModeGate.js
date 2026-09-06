// SPDX-License-Identifier: GPL-3.0-only
// When the mode gate byte is nonzero, save it into the status byte and repaint the player-status column;
// when it is zero, repaint only if the saved status byte is already set.
import { loc_4006, loc_40ab } from "./names.js";
import { repaintPlayerStatusColumnIfSaved } from "./repaintPlayerStatusColumnIfSaved.js";
import { repaintPlayerStatusColumn } from "./repaintPlayerStatusColumn.js";

export function repaintPlayerStatusColumnFromModeGate(m) {
  const { mem8 } = m;
  const gate = mem8[loc_4006];
  if (gate === 0) return repaintPlayerStatusColumnIfSaved(m);
  mem8[loc_40ab] = gate; // save the nonzero gate byte
  return repaintPlayerStatusColumn(m);
}
