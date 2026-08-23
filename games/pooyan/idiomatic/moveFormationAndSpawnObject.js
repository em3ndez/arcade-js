// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_4006 } from "./loc_4006.js";
import { loc_34f2 } from "./loc_34f2.js";
import { loc_343e } from "./loc_343e.js";
import { loc_3553 } from "./loc_3553.js";
import { loc_423a } from "./loc_423a.js";
import { loc_425c } from "./loc_425c.js";
import { initDescendingObjectSlot } from "./initDescendingObjectSlot.js";
import {
  STAGE_COUNTDOWN,
  SPAWN_SWEEP_TRIGGER,
  SPAWN_SWEEP_COUNTDOWN,
  SPAWN_SPEED_INDEX,
  SPAWN_SPEED_VALUE,
  ENEMY_ACTOR_TABLE,
  SPAWN_OBJECT_TABLE,
  SIGNATURE_CHECK_SRC,
  SIGNATURE_CHECK_TABLE,
  TAMPER_STRIKES_OBJSIG,
} from "./names.js";
/**
 * moveFormationAndSpawnObject — per-frame object-state handler for the record at IX (dispatch target). Ticks the
 * animation, then branches on (ix+8) bit0. Each branch reads (ix+6)&0x1f as a phase and, past its
 * threshold, arms a turn-animation script or drops into the shared bookkeeping tail (blockP), which
 * optionally clears the spawn-object table (blockC9). LIVE-OUT: memory only; a slot-init inside
 * blockC9 unwinds one frame up.
 *
 * blockC9 calls the slot initializer (moveFormationAndSpawnObject is its sole caller); a false return is the
 * caller-skip that aborts the sweep — the boolean that dissolves the pop-af/ret skip.
 */
export function moveFormationAndSpawnObject(m, ix = m.regs.ix) {
  const { mem8 } = m;

  const blockC9 = () => { // clear 3 stride-0x18 slots of the spawn-object table
    let slot = SPAWN_OBJECT_TABLE;
    let b = 0x03;
    do {
      if (!initDescendingObjectSlot(m, slot, ix)) return; // slot initialized -> caller-skip aborts the sweep
      slot = u16(slot + 0x18);
      b = (b - 1) & 0xff;
    } while (b !== 0);
  };

  const blockP = (phase) => { // shared bookkeeping tail (phase = (ix+6)&0x1f)
    if (phase < 0x05) return;
    if (mem8[SPAWN_SWEEP_TRIGGER] !== 0) return blockC9();
    if (mem8[SPAWN_SWEEP_COUNTDOWN] !== 0) {
      mem8[SPAWN_SWEEP_COUNTDOWN] = mem8[SPAWN_SWEEP_COUNTDOWN] - 1;
      return;
    }
    if (mem8[STAGE_COUNTDOWN] >= 0x08) { // scan the actor table for a settled slot ((iy+4)==7)
      let iy = ENEMY_ACTOR_TABLE;
      let n = mem8[SPAWN_SPEED_INDEX];
      let found = false;
      do {
        if (mem8[iy + 0x04] === 0x07) { found = true; break; }
        iy = u16(iy + 0x18);
        n = (n - 1) & 0xff;
      } while (n !== 0);
      if (!found) return;
    }
    const v = mem8[SPAWN_SPEED_VALUE]; // seed the sweep pair, then clear the table
    mem8[SPAWN_SWEEP_COUNTDOWN] = v;
    mem8[SPAWN_SWEEP_TRIGGER] = v;
    return blockC9();
  };

  loc_4006(m, ix);

  if ((mem8[ix + 0x08] & 0x01) !== 0) { // bit0 set
    loc_34f2(m, ix);
    const phase = mem8[ix + 0x06] & 0x1f;
    if (phase >= 0x0a) return blockP(phase);
    if (mem8[STAGE_COUNTDOWN] < 0x02) { // signature-check branch
      if (phase >= 0x02) return;
      loc_3553(m, ix); // blank the sprite band
      let src = SIGNATURE_CHECK_SRC; // program-image run summed descending vs the two's-complement table
      let tbl = SIGNATURE_CHECK_TABLE;
      for (;;) {
        if (((mem8[src] + mem8[tbl]) & 0xff) !== 0) { // mismatch -> bump the strike tally
          mem8[TAMPER_STRIKES_OBJSIG] = mem8[TAMPER_STRIKES_OBJSIG] + 1;
          return;
        }
        src = u16(src - 1);
        tbl = u16(tbl + 1);
        if (((mem8[tbl] + 1) & 0xff) === 0) return; // 0xff terminator
      }
    }
    mem8[ix + 0x08] = 0x00; // interior-entry arm
    return loc_425c(m, ix);
  }

  loc_343e(m, ix); // bit0 clear -> X-movement
  const phase = mem8[ix + 0x06] & 0x1f;
  if (phase < 0x14) return blockP(phase);
  mem8[ix + 0x08] = 0x01; // interior-entry arm
  return loc_423a(m, ix);
}
