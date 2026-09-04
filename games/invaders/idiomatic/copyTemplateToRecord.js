// SPDX-License-Identifier: GPL-3.0-only
import { blockCopy } from "./blockCopy.js";
import { loc_1b83 } from "./names.js";

/**
 * copyTemplateToRecord — stamp a fresh object record from a fixed ROM template.
 *
 * WHAT IT IS
 *   Copies B bytes from the ROM template at loc_1b83 (0x1b83) into the caller's destination record at
 *   HL. Object records (aliens, shots, the player ship, etc.) are initialised from small byte
 *   templates baked into ROM; this is the front door that points the general byte-mover at that one
 *   template. The caller supplies the destination (HL) and the length (B).
 *
 * ROLE IN THE MACHINE
 *   A thin wrapper over blockCopy (0x1a32), the general "copy B bytes (DE)->(HL), both advancing"
 *   primitive (a count of 0 means a full 256). It seats the source at loc_1b83 and forwards the
 *   caller's HL and B. loc_1b83 keeps a placeholder name — it is the ROM template block, its exact
 *   contents/role not yet pinned. Sibling copiers that share blockCopy include copyRecordToWorkBuffer
 *   and copyWorkBufferToRecord.
 *
 * ROM 0x075f.  Grounding: [seen] (source cell loc_1b83 role open).
 *
 * LIVE-OUT: blockCopy advances both pointers; HL/DE/B are left as blockCopy leaves them.
 */
export function copyTemplateToRecord(m, hl = m.regs.hl, b = m.regs.b) {
  // Point the general byte-mover at the ROM template (loc_1b83) as source, the caller's record (HL)
  // as destination, and copy B bytes into it.
  blockCopy(m, loc_1b83, hl, b);
}
