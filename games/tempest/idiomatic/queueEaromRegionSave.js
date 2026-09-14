// SPDX-License-Identifier: GPL-3.0-only
import { EAROM_BLANK_FLAG, EAROM_REGION_PENDING, EAROM_REGION_DIR } from "./names.js";

/**
 * queueEaromRegionSave — queue a plain (non-blanked) EAROM save of the region on bit 0x04. ROM 0xddfb.
 *
 * Role in the machine: the counterpart to the erase trampoline. The EAROM holds Tempest's high-score
 * table and persistent bookkeeping; writes are deferred through request bits that a later serial-shift
 * service drains. This entry asks for the region flagged by bit 0x04 to be written back with live data
 * (index 0, blank mode off) — the path used to commit a real save such as a new high score.
 *
 * The routine is a stack of three overlapping ROM entry points that fall through into one shared tail:
 *   - queueEaromRegionSave (0xddfb): presets mask A=0x04, then drops into the index-zero entry.
 *   - queueEaromRequestAtIndexZero (0xddfd): presets the target index Y=0x00, then drops into the tail.
 *   - queueEaromRequest (0xddff): the shared tail that actually stores the request.
 * Presetting the index to 0 (rather than 0xff) is what distinguishes a plain save from a blanked erase.
 *
 * Live-out: the blank-flag/index cell 0x1c6 (= Y), the region-pending cell 0x1c7 and the direction cell
 * 0x1c8 (each OR-ed with mask A). No chip I/O here — only the deferred request state. Grounding: [seen].
 */
export function queueEaromRegionSave(m) {
  // Region mask 0x04, then fall through to the index-zero (plain-save) entry.
  return queueEaromRequestAtIndexZero(m, 0x04);
}

// Middle entry: force the target index to 0 (plain save, not blank mode) and pass the caller's mask on.
export function queueEaromRequestAtIndexZero(m, a = m.regs.a) {
  return queueEaromRequest(m, a, 0x00);
}

// Shared tail: store the index Y into the blank-flag/index cell, then OR the mask A into both
// request-flag cells so the drain service knows which region is pending and in which direction.
export function queueEaromRequest(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  mem8[EAROM_BLANK_FLAG] = y; // 0x1c6: index/blank byte (0 = live save, 0xff = blank)
  mem8[EAROM_REGION_PENDING] = (mem8[EAROM_REGION_PENDING] | a); // 0x1c7: pending-region mask
  mem8[EAROM_REGION_DIR] = (mem8[EAROM_REGION_DIR] | a); // 0x1c8: direction mask
}
