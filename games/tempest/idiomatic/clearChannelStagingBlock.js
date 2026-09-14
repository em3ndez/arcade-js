// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_40 } from "./names.js";

/**
 * clearChannelStagingBlock — zero the six-byte sound-channel staging block loc_40..loc_45. ROM 0xca62.
 *
 * Role in the machine: Tempest's sound requests are assembled in a small working block at loc_40 before
 * they are seated as fresh channel entries. This leaf pre-clears that block so a new request starts from
 * a blank slate. It is used as a pre-clear step inside buildSortedSoundRequest (fired when loc_9&0x43==0x40)
 * and again during resetLevelPlayfieldSlots (when loc_5 is negative), i.e. whenever the staging area must be
 * wiped before the channel triple (loc_40/loc_41/loc_42 and neighbours) is repopulated.
 *
 * Behavior: a single top-down loop over the six cells loc_40 through loc_45 (index x from 5 down to 0),
 * storing 0x00 into each, then an explicit return. Zero-page addressing is kept via u8() on the base+index
 * so the write wraps in the low page exactly as the original 6502 code did. No flags, no other state.
 *
 * Live-out: loc_40..loc_45 all = 0, ready to be staged. Nothing else touched. Grounding: [seen].
 */
export function clearChannelStagingBlock(m) {
  const { mem8 } = m;
  // Blank the six staging cells loc_40..loc_45 top-down (zero-page wrap preserved via u8()).
  for (let x = 5; x >= 0; x--) mem8[u8(loc_40 + x)] = 0x00;
  return;
}
