// SPDX-License-Identifier: GPL-3.0-only
import { blockCopy } from "./blockCopy.js";
import { OBJECT_WORK_BUFFER } from "./names.js";

/**
 * copyWorkBufferToRecord (ROM 0x055b) -- write an object's move-record strip back out of scratch.
 *
 * WHAT IT IS
 *   Copies the 11-byte (0x0b) object strip from the shared work buffer at OBJECT_WORK_BUFFER (0x2073) back into the
 *   caller's destination record (HL). It is the twin/inverse of copyRecordToWorkBuffer (0x0550), which
 *   lifts a record INTO that buffer.
 *
 * ROLE IN THE MACHINE
 *   The alien-shot object handlers work on a record in-place by first priming it into the fixed 11-byte
 *   scratch strip OBJECT_WORK_BUFFER (copyRecordToWorkBuffer), stepping it, and then -- on the paths that keep the
 *   record -- writing the strip back to the record with this routine. OBJECT_WORK_BUFFER is the same scratch buffer
 *   stepAlienShot treats as the live shot's descriptor. Delegates the move to blockCopy.
 *
 * ROM 0x055b.  Grounding: [seen] (names.js cert for 0x055b).
 *
 * LIVE-OUT: memory only (blockCopy advances HL/DE internally but no caller reads them here).
 */
// Copy the 11-byte object strip from the shared buffer back into the caller's destination.
export function copyWorkBufferToRecord(m, hl = m.regs.hl) {
  // blockCopy(source=OBJECT_WORK_BUFFER, dest=HL, count=0x0b): pour the 11 scratch bytes into the caller's record.
  blockCopy(m, OBJECT_WORK_BUFFER, hl, 0x0b);
}
