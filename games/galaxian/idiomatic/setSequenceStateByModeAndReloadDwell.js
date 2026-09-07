// SPDX-License-Identifier: GPL-3.0-only
//
// setSequenceStateByModeAndReloadDwell — jump the sequence state to a fixed value, then re-arm.
//
// WHAT IT IS
//   Writes one of two constant markers into the sequence-state cell the caller points at (HL,
//   which arrives on SEQUENCE_STATE 0x400a) — 4 when the mode flag loc_4006 bit0 is set, 14 when
//   it is clear — and then re-arms the dwell timer so the newly-selected state runs from a full
//   dwell rather than a stale one.
//
// ROLE IN THE MACHINE
//   The sequence machine advances itself by a dwell-timer cascade; a handler that jumps the state
//   index must leave the timer ready for the next state. This is one such helper: it stamps the
//   index (loc_4006 chooses which of the two fixed sub-states to enter) then delegates to
//   reloadSequenceDwellTimer (0x070e), which re-arms the dwell tier loc_4009.
//
// ROM 0x0712.  Grounding: [seen].
// LIVE-OUT: the sequence-state cell (via `counter`/HL) and the dwell timer loc_4009.
import { reloadSequenceDwellTimer } from "./reloadSequenceDwellTimer.js";
import { loc_4006 } from "./names.js";

export function setSequenceStateByModeAndReloadDwell(m, counter = m.regs.hl) {
  // Mode bit set -> state 4, clear -> state 14: pick the fixed marker and stamp it into the cell.
  m.mem8[counter] = (m.mem8[loc_4006] & 1) ? 4 : 14;
  // Re-arm the dwell timer so the freshly-selected state gets a full dwell before it advances.
  reloadSequenceDwellTimer(m);
}
