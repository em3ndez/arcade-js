// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_2514 } from "./loc_2514.js";
import {
  LAUNCH_FLIP_COUNTDOWN,
  ANIM_PHASE_TOGGLE_892C,
  SHARED_PHASE_COUNTDOWN,
  SHARED_PHASE_GATE,
  HUNTER_TABLE_BASE,
  HUD_INTEGRITY_STRIP_A,
  TILE_SRC_ROW_66BF,
  TILE_SRC_ROW_66C2,
} from "./names.js";
/**
 * loc_6566 — per-frame fountain-record animation step, gated by a flip countdown.
 *
 * While the flip countdown is nonzero this only ticks it down and returns. When it hits
 * zero the routine advances a phase toggle; its bit0 selects the shrink (odd) or grow
 * (even) half. Each half rewrites the X/size fields of three mirror copies of the record
 * — a base bank and two shadow banks a fixed step below. The shrink half then renders
 * the three records from a bit0-selected tile-source row. The grow half instead reseeds
 * the record's timers and runs an integrity sweep over the mirror bank, throwing if a
 * slot disagrees with its shadow or the running checksum is wrong (never with intact
 * data).
 *
 * LIVE-OUT: none — the whole effect is in RAM. The dispatch caller reloads its own
 * pointers after the call, so no register survives as an input to any successor.
 */

const GROW_SEED = 0x06; // flip-countdown reseed for the grow (even) half
const SHRINK_SEED = 0x0c; // flip-countdown reseed for the shrink (odd) half
const MIRROR_A = 0x18; // first shadow bank sits this far below a base field
const MIRROR_B = 0x30; // second shadow bank sits this far below a base field
const RECORD_STEP_BACK = u16(-MIRROR_A); // render walks one record back per copy
const RENDER_COUNT = 0x03; // records written per render pass
const FIELD_CAP = 0x0c; // sweep skips the record once its +6 field reaches this

export function loc_6566(m, ix = m.regs.ix) {
  const { mem8 } = m;

  // Countdown still running: just tick it down and leave.
  if (mem8[LAUNCH_FLIP_COUNTDOWN] !== 0) {
    mem8[LAUNCH_FLIP_COUNTDOWN] = mem8[LAUNCH_FLIP_COUNTDOWN] - 1;
    return;
  }

  // Countdown expired: advance the phase toggle; bit0 selects the half.
  mem8[ANIM_PHASE_TOGGLE_892C] = mem8[ANIM_PHASE_TOGGLE_892C] + 1;

  if ((mem8[ANIM_PHASE_TOGGLE_892C] & 0x01) !== 0) {
    // ---- shrink (odd) half ----
    mem8[LAUNCH_FLIP_COUNTDOWN] = SHRINK_SEED;

    // +3 field minus its +8 delta; a borrow ticks the +4 field of all three banks down.
    const f3 = mem8[u16(ix + 3)];
    const d8 = mem8[u16(ix + 8)];
    let a = (f3 - d8) & 0xff;
    if (f3 < d8) {
      mem8[u16(ix + 4)] = mem8[u16(ix + 4)] - 1;
      mem8[u16(ix + 4 - MIRROR_A)] = mem8[u16(ix + 4 - MIRROR_A)] - 1;
      mem8[u16(ix + 4 - MIRROR_B)] = mem8[u16(ix + 4 - MIRROR_B)] - 1;
    }
    mem8[u16(ix + 3)] = a;
    mem8[u16(ix + 3 - MIRROR_A)] = a;
    mem8[u16(ix + 3 - MIRROR_B)] = a;

    // +5 field minus its +9 delta; a borrow steps the +6 field down the three banks (−1,−3,−5).
    const f5 = mem8[u16(ix + 5)];
    const d9 = mem8[u16(ix + 9)];
    a = (f5 - d9) & 0xff;
    mem8[u16(ix + 5)] = a;
    mem8[u16(ix + 5 - MIRROR_A)] = a;
    mem8[u16(ix + 5 - MIRROR_B)] = a;
    if (f5 < d9) {
      a = (mem8[u16(ix + 6)] - 1) & 0xff;
      mem8[u16(ix + 6)] = a;
      a = (a - 2) & 0xff;
      mem8[u16(ix + 6 - MIRROR_A)] = a;
      a = (a - 2) & 0xff;
      mem8[u16(ix + 6 - MIRROR_B)] = a;
    }

    // Render the three records from the source row the toggle's current bit0 selects.
    const src = (mem8[ANIM_PHASE_TOGGLE_892C] & 0x01) !== 0 ? TILE_SRC_ROW_66C2 : TILE_SRC_ROW_66BF;
    loc_2514(m, src, RENDER_COUNT, RECORD_STEP_BACK, ix, RECORD_STEP_BACK & 0xff);
    return;
  }

  // ---- grow (even) half ----
  mem8[LAUNCH_FLIP_COUNTDOWN] = GROW_SEED;
  const base = mem8[u16(ix + 3)];
  const delta = mem8[u16(ix + 8)];
  const grown = base + delta;
  if (grown > 0xff) {
    mem8[u16(ix + 4)] = mem8[u16(ix + 4)] + 1;
    mem8[u16(ix + 4 - MIRROR_A)] = mem8[u16(ix + 4 - MIRROR_A)] + 1;
    mem8[u16(ix + 4 - MIRROR_B)] = mem8[u16(ix + 4 - MIRROR_B)] + 1;
  }
  const gv = grown & 0xff;
  mem8[u16(ix + 3)] = gv;
  mem8[u16(ix + 3 - MIRROR_A)] = gv;
  mem8[u16(ix + 3 - MIRROR_B)] = gv;

  // ---- fall through to the mirror-bank integrity sweep on the hunter record ----
  const rec = HUNTER_TABLE_BASE;
  if (mem8[u16(rec + 6)] >= FIELD_CAP) return; // record already past the cap: nothing to do

  // Reseed the record's three timer fields across the base + two shadow banks.
  mem8[u16(rec + 0x10)] = 0x40;
  mem8[u16(rec + 0x10 - MIRROR_A)] = 0x40;
  mem8[u16(rec + 0x10 - MIRROR_B)] = 0x40;
  mem8[u16(rec + 9)] = 0x18;
  mem8[u16(rec + 9 - MIRROR_A)] = 0x18;
  mem8[u16(rec + 9 - MIRROR_B)] = 0x18;
  mem8[u16(rec + 2)] = 0x02;
  mem8[u16(rec + 2 - MIRROR_A)] = 0x02;
  mem8[u16(rec + 2 - MIRROR_B)] = 0x02;
  mem8[SHARED_PHASE_GATE] = 0x02;
  mem8[SHARED_PHASE_COUNTDOWN] = 0x02;

  // Pass 1: each strip slot must equal its shadow one row (0x20) below; sum the slots (16-bit).
  let ptr = HUD_INTEGRITY_STRIP_A;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const v = mem8[ptr];
    if (v !== mem8[u16(ptr - 0x20)]) throw new Error("loc_6566: mirror-bank slot mismatch (integrity guard)");
    sum = u16(sum + v);
    ptr = u16(ptr - 0x20);
  }

  // Step the cursor up into the second strip (high byte += 4) and keep summing 10 more rows.
  ptr = u16(((((ptr >> 8) + 0x04) & 0xff) << 8) | (ptr & 0xff));
  for (let i = 0; i < 10; i++) {
    sum = u16(sum + mem8[ptr]);
    ptr = u16(ptr + 0x20);
  }

  // Intact data leaves the running 16-bit checksum at its one valid total.
  if ((sum & 0xff) !== 0x2a) throw new Error("loc_6566: mirror-bank checksum low mismatch (integrity guard)");
  if (((sum >> 8) & 0xff) !== 0x01) throw new Error("loc_6566: mirror-bank checksum high mismatch (integrity guard)");
}
