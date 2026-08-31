// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectPhaseThenAuditChecksum } from "./advanceObjectPhaseThenAuditChecksum.js";
import { descendObjectToLanding } from "./descendObjectToLanding.js";
import { advanceObjectDwellThenBlankBand } from "./advanceObjectDwellThenBlankBand.js";
import { noopLowStateHandler } from "./noopLowStateHandler.js";
import { armObjectAnimationAndSeedCountdown } from "./armObjectAnimationAndSeedCountdown.js";
import { advanceObjectCountdownAndEmitDisplayCommand } from "./advanceObjectCountdownAndEmitDisplayCommand.js";
import { moveFormationAndSpawnObject } from "./moveFormationAndSpawnObject.js";
import { countdownThenRearmTurnAnimationByFlag } from "./countdownThenRearmTurnAnimationByFlag.js";
import { advanceObjectFallStepThenBlankBandOnLand } from "./advanceObjectFallStepThenBlankBandOnLand.js";
import { noopHighStateHandler } from "./noopHighStateHandler.js";
/**
 * dispatchObjectStateHandler — IX-object state dispatcher. Skips an inactive record (bit0 of (IX+0)|(IX+1) clear) and an
 * out-of-range state ((IX+2)&0x1f >= 0x11). Otherwise tail-hands the state to one of 17 handlers; each
 * returns straight to our caller (no continuation stacked). LIVE-OUT: memory only.
 */
export function dispatchObjectStateHandler(m, rec = m.regs.ix) {
  const { mem8 } = m;
  if (((mem8[rec + 0x00] | mem8[rec + 0x01]) & 1) === 0) return; // inactive record
  const state = mem8[rec + 0x02] & 0x1f;
  if (state >= 0x11) return; // state index out of range (cp 0x11 -> ret nc)
  switch (state) {
    case 0: return advanceObjectPhaseThenAuditChecksum(m, rec);
    case 1: return descendObjectToLanding(m, rec);
    case 2: return advanceObjectDwellThenBlankBand(m, rec);
    case 3: case 4: case 5: case 6: case 7: return noopLowStateHandler(m);
    case 8: return armObjectAnimationAndSeedCountdown(m, rec);
    case 9: return advanceObjectCountdownAndEmitDisplayCommand(m, rec);
    case 10: return noopLowStateHandler(m);
    case 11: return moveFormationAndSpawnObject(m, rec);
    case 12: return countdownThenRearmTurnAnimationByFlag(m, rec);
    case 13: return advanceObjectFallStepThenBlankBandOnLand(m, rec);
    case 14: case 15: case 16: return noopHighStateHandler(m);
  }
}
