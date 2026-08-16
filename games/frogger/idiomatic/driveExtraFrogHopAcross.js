// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveExtraFrogHopAcross — the in-play extra-frog hop-across spawn/animate driver, run each vblank.
 * Returns unless the suppress flag, the hold flag, and the spawn-dwell counter are all clear; a running
 * dwell just ticks down. Otherwise it re-arms the dwell, advances the phase index, reads that phase's
 * frame code from the script table and dispatches it: 0x02/05/08/0b re-run one directional hop-begin
 * (LEFT/RIGHT/UP/DOWN), 0x0e is a no-op frame, 0xff resets the phase and clears the driver's flags.
 * LIVE-OUT: memory-only.
 */
import { NotImplemented } from "../../../boards/frogger/io.js";
import { FROG_X, FROG_Y, HOLD_FLAG, TWO_PLAYER_START_FLAG, loc_826c, loc_829a } from "./names.js";
import {
  beginFrogHopLeft, beginFrogHopRight, beginFrogHopUp, beginFrogHopDown,
} from "./animateFrogHop.js";

const SPAWN_DWELL = 0x8299;
const HOP_FRAME_TABLE = 0x2e68;
const DWELL_RELOAD = 0x30;

export function driveExtraFrogHopAcross(m) {
  const { regs, mem8 } = m;

  if (mem8[loc_826c] !== 0) return;
  if (mem8[HOLD_FLAG] !== 0) return;

  const dwell = mem8[SPAWN_DWELL];
  if (dwell !== 0) {
    mem8[SPAWN_DWELL] = (dwell - 1) & 0xff;
    return;
  }

  regs.de = FROG_Y; // hop-begin handler live-ins (armed as the caller does)
  mem8[SPAWN_DWELL] = DWELL_RELOAD;
  const phase = (mem8[loc_829a] + 1) & 0xff;
  mem8[loc_829a] = phase;

  const code = mem8[HOP_FRAME_TABLE + phase];
  if (code === 0xff) return resetExtraFrog(m);

  regs.hl = FROG_X;
  switch (code) {
    case 0x02: return beginFrogHopLeft(m);
    case 0x05: return beginFrogHopRight(m);
    case 0x08: return beginFrogHopUp(m);
    case 0x0b: return beginFrogHopDown(m);
    case 0x0e: return; // trailing no-op frame slot
    default:
      throw new NotImplemented(
        `driveExtraFrogHopAcross: frame code 0x${code.toString(16)} at phase ${phase} is not a dispatch slot`,
      );
  }
}

// End-of-script frame: reset the phase index and clear the driver's flags.
function resetExtraFrog(m) {
  const { mem8 } = m;
  mem8[loc_829a] = 0;
  mem8[SPAWN_DWELL] = 0;
  mem8[TWO_PLAYER_START_FLAG] = 0;
}
