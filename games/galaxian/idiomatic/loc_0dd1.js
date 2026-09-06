// SPDX-License-Identifier: GPL-3.0-only
// Actor state-step: bump the actor's phase counter, then pick its horizontal-move handler by the kind
// field -- kind value 0x60 uses the stored/player target select, every other kind the cross-player select.
import { commitMoveToStoredOrPlayerTargetX } from "./commitMoveToStoredOrPlayerTargetX.js";
import { commitMoveAcrossPlayerX } from "./commitMoveAcrossPlayerX.js";

const KIND_MASK = 0x70;
const KIND_STORED_TARGET = 0x60;

export function loc_0dd1(m, record = m.regs.ix) {
  const { mem8 } = m;
  mem8[record + 0x03] = mem8[record + 0x03] + 1; // phase/anim counter

  if ((mem8[record + 0x07] & KIND_MASK) === KIND_STORED_TARGET) {
    return commitMoveToStoredOrPlayerTargetX(m, record);
  }
  return commitMoveAcrossPlayerX(m, record);
}
