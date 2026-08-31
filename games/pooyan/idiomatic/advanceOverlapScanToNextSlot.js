// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { testRecordOverlapRetireOrFlagHit } from "./testRecordOverlapRetireOrFlagHit.js";
/**
 * advanceOverlapScanToNextSlot — the advance-and-loop latch of the six-slot overlap scan.
 *
 * WHAT IT IS
 *   The loop back-edge of Pooyan's per-frame overlap scan — the little step the scan pass
 *   (testRecordOverlapRetireOrFlagHit) hands control to whenever the record it just examined was
 *   NOT a hit: an empty slot, a record of the wrong type, or a box that missed the target on either
 *   axis. Its whole job is to move both walking cursors on to the next slot, count the remaining
 *   slots down by one, and decide what happens next — re-enter the scan pass for that next slot, or,
 *   when no slots are left, declare the sweep finished with nothing struck.
 *
 * ROLE IN THE MACHINE
 *   The scan walks two parallel per-slot arrays in lockstep, one entry apiece per candidate object:
 *     - a POSITION box (parameter `index`, default the IX register), one entry every INDEX_STRIDE
 *       (4) bytes — the scan pass reads a screen X at +0 and a screen Y at +2 out of it to build the
 *       candidate's collision box;
 *     - an ACTOR RECORD (parameter `geom`, default the HL register), one entry every GEOM_STRIDE
 *       (0x18) bytes — the scan pass reads the record-active flag at +0 and the record type at +2.
 *   The remaining slot count rides in `slots` (default the B register); the canonical sweep starts
 *   at six. The record type being matched (`type`, default C) and the fixed target box the whole
 *   sweep is measured against (`target`, default IY) are invariants: this latch never inspects them,
 *   it only threads them straight back into the next pass so every slot is tested the same way.
 *
 * ROM: 0x6018-0x6024.
 * Grounding: [seen].
 *
 * LIVE-OUT: a boolean — true when the sweep runs out of slots (every candidate tested, none
 *   overlapped), otherwise whatever the re-entered pass reports (false = a hit; the strike aborts
 *   the sweep and unwinds back up through the caller's loop so no further slot is tested). As machine
 *   side effects it also leaves the advanced cursors in IX/HL and the decremented count in B — the
 *   exact inputs the re-entered pass consumes — and DE holding 0x18, the residue of the two-step
 *   pointer arithmetic below.
 */

const INDEX_STRIDE = 4;
const GEOM_STRIDE = 0x18;

export function advanceOverlapScanToNextSlot(m, index = m.regs.ix, geom = m.regs.hl, slots = m.regs.b, type = m.regs.c, target = m.regs.iy) {
  // ROM 0x6018-0x601f: step both cursors on to the next slot. The position-box cursor advances one
  // 4-byte entry (ld de,0x0004 @0x6018 then add ix,de @0x601b) and the record cursor advances one
  // 0x18-byte entry (ld e,0x18 @0x601d reloading DE's low byte, then add hl,de @0x601f). Each sum is
  // wrapped to 16 bits, matching the Z80's address arithmetic.
  const nextIndex = u16(index + INDEX_STRIDE);
  const nextGeom = u16(geom + GEOM_STRIDE);
  // ROM 0x6020 (dec b): count the sweep down by one slot, wrapped to a byte. A nonzero result means
  // more candidates remain; zero means the slot just tested was the last one.
  const remaining = u8(slots - 1);

  // ROM 0x6021 (jp nz,0x5fa2): slots still remain, so loop back into the scan pass for the next one.
  // Commit the advanced cursors to IX/HL and the new count to B, and leave DE = 0x18 (the low byte
  // reloaded above), then feed the next position box + record to testRecordOverlapRetireOrFlagHit
  // with the matched type and the fixed target carried through untouched. Whatever it reports (true =
  // still no hit, false = a hit that aborts the sweep) becomes this latch's own result.
  if (remaining !== 0) {
    return (m.regs.ix = nextIndex, m.regs.hl = nextGeom, m.regs.b = remaining, m.regs.de = GEOM_STRIDE, testRecordOverlapRetireOrFlagHit(m, nextGeom, nextIndex, remaining, type, target));
  }
  // ROM 0x6024 (ret): the slots are exhausted with no overlap anywhere in the sweep. Commit the
  // now-past-the-end cursors and B = 0 to keep the machine state faithful, leave DE = 0x18, and
  // report the clean sweep by returning true.
  return (m.regs.ix = nextIndex, m.regs.hl = nextGeom, m.regs.b = 0, m.regs.de = GEOM_STRIDE, true);
}
