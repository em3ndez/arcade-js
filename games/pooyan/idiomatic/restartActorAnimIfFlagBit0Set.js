// SPDX-License-Identifier: GPL-3.0-only
import { restartActorAnimUnlessPhaseAdvanced } from "./restartActorAnimUnlessPhaseAdvanced.js";
/**
 * restartActorAnimIfFlagBit0Set — spawn-step guard on a record flag.
 *
 * Tests bit 0 of the record's flag byte (rec+8): when clear the routine returns and leaves
 * the record untouched; when set it runs the spawn/queue-step helper on the same record,
 * which either no-ops (phase already advanced) or clears a field and re-arms the record's
 * animation.
 *
 * LIVE-OUT: memory only — nothing on the guard-clear path, else the helper's record writes.
 */

export function restartActorAnimIfFlagBit0Set(m, rec = m.regs.ix) {
  const { mem8 } = m;
  if ((mem8[rec + 0x08] & 0x01) === 0) return;
  restartActorAnimUnlessPhaseAdvanced(m, rec);
}
