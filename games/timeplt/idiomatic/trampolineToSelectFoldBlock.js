// SPDX-License-Identifier: GPL-3.0-only
/** trampolineToSelectFoldBlock — a bare transfer to 0x08AE and no return; no cell is read or
 * written and no register moves.
 *
 * ROLE. One link of the game's anti-tamper machinery. In the ROM this is a three-byte
 * `jp 0x08ae`, so an entry here lands in selectFoldBlock, which hands back a fixed block of the
 * program image to fold -- thirty bytes starting at seatCaptionPenFromEraFoldingTamperIntoPhase's
 * own entry point -- as a pointer and a count. selectFoldBlock records this address as the only
 * transfer into it; this routine's single caller then runs the summing loop at 0x291E over that
 * block and banks the total for a later sequence arm to check. This routine adds nothing of its
 * own: control leaves for that one fixed destination and never comes back here.
 *
 * ROM 0x4BD9-0x4BDB (frozen lift translated/loc_4bd9.js). Grounding: [seen] (names.js ROUTINES
 * 0x4bd9). LIVE-OUT: whatever the destination leaves.
 */

import { selectFoldBlock } from "./selectFoldBlock.js";

export function trampolineToSelectFoldBlock(m) {
  // Tail transfer: whatever selectFoldBlock returns is this routine's result.
  return selectFoldBlock(m);
}
