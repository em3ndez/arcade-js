// SPDX-License-Identifier: GPL-3.0-only
import { EAROM_BLANK_FLAG, EAROM_REGION_PENDING, EAROM_REGION_DIR } from "./names.js";

/**
 * queueEaromEraseAllRegions -- queue a blanked (erase) write of all three EAROM regions. ROM 0xddf1.
 *
 * Role in the machine: Tempest keeps its high-score / bookkeeping table in an EAROM (electrically
 * alterable ROM) that is written a nibble at a time by a background transfer state machine. This routine
 * does not touch the EAROM itself; it merely arms the transfer to blank all three saved regions on the
 * next pass. It is called from the self-test path (runSelfTestLoop) to clear the stored table.
 *
 * Behavior: stamps 0xff into the blank flag EAROM_BLANK_FLAG ($1c6) -- telling the transfer engine the
 * pending write is an erase, not real data -- then ORs the three-region mask 0x07 into both the
 * pending-request cell EAROM_REGION_PENDING ($1c7) and the direction cell EAROM_REGION_DIR ($1c8), so all
 * three regions are marked dirty and headed the erase direction. Using OR preserves any bits already set.
 *
 * Live-out: $1c6=0xff, and bits 0..2 set in $1c7 and $1c8; the actual erase is carried out later by
 * stepEaromTransfer. Grounding: [seen].
 */
export function queueEaromEraseAllRegions(m) {
  const { mem8 } = m;
  mem8[EAROM_BLANK_FLAG] = 0xff;                                  // mark the pending write as a blank/erase ($1c6)
  mem8[EAROM_REGION_PENDING] = (mem8[EAROM_REGION_PENDING] | 0x07); // request all three regions ($1c7)
  mem8[EAROM_REGION_DIR] = (mem8[EAROM_REGION_DIR] | 0x07);         // set all three to the erase direction ($1c8)
}
