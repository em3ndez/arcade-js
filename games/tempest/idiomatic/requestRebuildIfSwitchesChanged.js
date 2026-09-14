// SPDX-License-Identifier: GPL-3.0-only
import { DSW2_SNAPSHOT, INPUT_SNAPSHOT_HI, DSW_DIFFICULTY, INPUT_SNAPSHOT_LO } from "./names.js";
import { decodeOptionSwitches } from "./decodeOptionSwitches.js";
import { raiseRebuildRequestBits } from "./raiseRebuildRequestBits.js";
import { switchesUnchangedReturn } from "./switchesUnchangedReturn.js";

// Refresh the live control snapshot, then request a rebuild whenever it no longer
// matches the two cached target bytes.
export function requestRebuildIfSwitchesChanged(m) {
  const { mem8 } = m;
  decodeOptionSwitches(m);
  const match =
    (mem8[DSW2_SNAPSHOT] & 0xf8) === mem8[INPUT_SNAPSHOT_HI] &&
    (mem8[DSW_DIFFICULTY] & 0x03) === mem8[INPUT_SNAPSHOT_LO];
  if (match) return switchesUnchangedReturn();
  return raiseRebuildRequestBits(m);
}
