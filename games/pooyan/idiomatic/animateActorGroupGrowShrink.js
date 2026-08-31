// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { copyDisplayTilesIntoActorRecords } from "./copyDisplayTilesIntoActorRecords.js";
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
 * animateActorGroupGrowShrink — the fountain object's per-frame grow/shrink pulse.
 *
 * WHAT IT IS
 *   ROM 0x6566-0x6665. One frame's step of the pulsing "fountain" actor group. The fountain
 *   is drawn as three stacked copies of a single actor record; on alternating beats their X
 *   position and on-screen size are pushed outward (grow) then pulled back in (shrink),
 *   producing the breathing/fountain motion. A flip countdown paces the beats so the pulse
 *   runs slower than the 60 Hz frame it is called on.
 *
 * ROLE IN THE MACHINE
 *   Runs once per frame as part of the object driver. The three copies are a base bank at the
 *   record pointer (ix) plus two shadow banks sitting a fixed 0x18 and 0x30 bytes below it in
 *   memory. Because the three pieces must move as one, every field this routine touches is
 *   written into all three banks. The beat is chosen by the phase toggle at 0x892c (bit0):
 *     - shrink (odd): pull the +3 X field in by its +8 delta and the +5 size field in by its
 *       +9 delta (borrows ripple the +4 and +6 high fields down all three banks), then redraw
 *       the three copies from a ROM tile-source row.
 *     - grow (even): push the +3 X field out by its +8 delta (a carry rolls the +4 field up),
 *       then reseed the hunter record's timers and run an anti-tamper integrity sweep over a
 *       colour video-RAM strip.
 *
 * Grounding: [seen]
 *
 * LIVE-OUT: none — the whole effect lands in RAM (the three record banks, the phase toggle
 * 0x892c, the flip countdown 0x892f, and on the grow beat the hunter record at 0x8c78 plus the
 * shared phase cells 0x892e/0x8930). No register survives as an input to any later step.
 */

// Flip-countdown reseed values: how many frames each beat's shape holds on screen before the
// next beat runs. The countdown lives at 0x892f.
const GROW_SEED = 0x06; // flip-countdown reseed for the grow (even) half
const SHRINK_SEED = 0x0c; // flip-countdown reseed for the shrink (odd) half
// The fountain's three copies are the base record plus two shadows a fixed distance below it
// in memory; every position/size field is mirrored into all three so the copies stay aligned.
const MIRROR_A = 0x18; // first shadow bank sits this far below a base field
const MIRROR_B = 0x30; // second shadow bank sits this far below a base field
const RECORD_STEP_BACK = u16(-MIRROR_A); // render walks one record back per copy
const RENDER_COUNT = 0x03; // records written per render pass
const FIELD_CAP = 0x0c; // sweep skips the record once its +6 field reaches this

export function animateActorGroupGrowShrink(m, ix = m.regs.ix) {
  const { mem8 } = m;

  // The flip countdown at 0x892f paces the pulse: it is reloaded at the end of each beat and
  // counted down here every frame. While it is still running the fountain holds its current
  // shape, so just tick the countdown down and leave without disturbing any record.
  if (mem8[LAUNCH_FLIP_COUNTDOWN] !== 0) {
    mem8[LAUNCH_FLIP_COUNTDOWN] = mem8[LAUNCH_FLIP_COUNTDOWN] - 1;
    return;
  }

  // Countdown reached zero: this frame begins a new beat. Advance the phase toggle at 0x892c;
  // its bit0 alternates each beat and selects the half — set = shrink (odd), clear = grow
  // (even) — and, for the shrink render, which ROM tile-source row is drawn.
  mem8[ANIM_PHASE_TOGGLE_892C] = mem8[ANIM_PHASE_TOGGLE_892C] + 1;

  if ((mem8[ANIM_PHASE_TOGGLE_892C] & 0x01) !== 0) {
    // ---- shrink (odd) half ----
    // Reload the flip countdown so the shrunk shape holds for SHRINK_SEED frames.
    mem8[LAUNCH_FLIP_COUNTDOWN] = SHRINK_SEED;

    // X coordinate: pull the +3 low byte in by its +8 delta. An 8-bit borrow (f3 < d8) means
    // the coordinate wrapped past zero, so the +4 high byte drops by one — applied to the base
    // bank and both shadow banks (0x18 / 0x30 below) so the three copies stay in step.
    const f3 = mem8[u16(ix + 3)];
    const d8 = mem8[u16(ix + 8)];
    let a = (f3 - d8) & 0xff;
    if (f3 < d8) {
      mem8[u16(ix + 4)] = mem8[u16(ix + 4)] - 1;
      mem8[u16(ix + 4 - MIRROR_A)] = mem8[u16(ix + 4 - MIRROR_A)] - 1;
      mem8[u16(ix + 4 - MIRROR_B)] = mem8[u16(ix + 4 - MIRROR_B)] - 1;
    }
    // Store the reduced low byte to the +3 field of all three banks.
    mem8[u16(ix + 3)] = a;
    mem8[u16(ix + 3 - MIRROR_A)] = a;
    mem8[u16(ix + 3 - MIRROR_B)] = a;

    // Size: pull the +5 field in by its +9 delta, into all three banks.
    const f5 = mem8[u16(ix + 5)];
    const d9 = mem8[u16(ix + 9)];
    a = (f5 - d9) & 0xff;
    mem8[u16(ix + 5)] = a;
    mem8[u16(ix + 5 - MIRROR_A)] = a;
    mem8[u16(ix + 5 - MIRROR_B)] = a;
    // A borrow here steps the +6 high field down, staggered across the banks: -1 for the base,
    // then -2 more per shadow (net -3 and -5), matching their 0x18 / 0x30 memory offsets.
    if (f5 < d9) {
      a = (mem8[u16(ix + 6)] - 1) & 0xff;
      mem8[u16(ix + 6)] = a;
      a = (a - 2) & 0xff;
      mem8[u16(ix + 6 - MIRROR_A)] = a;
      a = (a - 2) & 0xff;
      mem8[u16(ix + 6 - MIRROR_B)] = a;
    }

    // Redraw the three fountain copies from a ROM tile-source row. The phase toggle's current
    // bit0 picks the row — 0x66c2 when set, 0x66bf when clear — so successive shrink frames
    // alternate tiles. Each copy is written one record (0x18) back from the last.
    const src = (mem8[ANIM_PHASE_TOGGLE_892C] & 0x01) !== 0 ? TILE_SRC_ROW_66C2 : TILE_SRC_ROW_66BF;
    copyDisplayTilesIntoActorRecords(m, src, RENDER_COUNT, RECORD_STEP_BACK, ix, RECORD_STEP_BACK & 0xff);
    return;
  }

  // ---- grow (even) half ----
  // Reload the flip countdown for the grown shape's hold time.
  mem8[LAUNCH_FLIP_COUNTDOWN] = GROW_SEED;
  // X coordinate: push the +3 low byte out by its +8 delta. A carry past 0xff rolls the +4
  // high byte up across all three banks.
  const base = mem8[u16(ix + 3)];
  const delta = mem8[u16(ix + 8)];
  const grown = base + delta;
  if (grown > 0xff) {
    mem8[u16(ix + 4)] = mem8[u16(ix + 4)] + 1;
    mem8[u16(ix + 4 - MIRROR_A)] = mem8[u16(ix + 4 - MIRROR_A)] + 1;
    mem8[u16(ix + 4 - MIRROR_B)] = mem8[u16(ix + 4 - MIRROR_B)] + 1;
  }
  // Store the grown low byte to the +3 field of all three banks.
  const gv = grown & 0xff;
  mem8[u16(ix + 3)] = gv;
  mem8[u16(ix + 3 - MIRROR_A)] = gv;
  mem8[u16(ix + 3 - MIRROR_B)] = gv;

  // ---- the grow beat also refreshes the hunter record and runs an anti-tamper sweep ----
  // The hunter record's base is at 0x8c78.
  const rec = HUNTER_TABLE_BASE;
  if (mem8[u16(rec + 6)] >= FIELD_CAP) return; // record already past the cap: nothing to do

  // Reseed the hunter record's three timer fields — +0x10 (0x40), +9 (0x18), +2 (0x02) — in the
  // base bank and both shadow banks (0x18 / 0x30 below), so all three copies restart together.
  mem8[u16(rec + 0x10)] = 0x40;
  mem8[u16(rec + 0x10 - MIRROR_A)] = 0x40;
  mem8[u16(rec + 0x10 - MIRROR_B)] = 0x40;
  mem8[u16(rec + 9)] = 0x18;
  mem8[u16(rec + 9 - MIRROR_A)] = 0x18;
  mem8[u16(rec + 9 - MIRROR_B)] = 0x18;
  mem8[u16(rec + 2)] = 0x02;
  mem8[u16(rec + 2 - MIRROR_A)] = 0x02;
  mem8[u16(rec + 2 - MIRROR_B)] = 0x02;
  // Arm the shared actor phase: raise the gate flag at 0x8930 and load the shared phase
  // countdown at 0x892e, both to 0x02.
  mem8[SHARED_PHASE_GATE] = 0x02;
  mem8[SHARED_PHASE_COUNTDOWN] = 0x02;

  // Anti-tamper sweep over the colour video-RAM strip based at 0x82bc. Pass 1 walks 10 tile
  // rows upward (stride -0x20): each slot must equal its shadow one row (0x20) below, and each
  // value folds into a running 16-bit checksum. With intact video RAM every slot matches its
  // shadow, so the mismatch throw is unreachable — a mismatch would be tampering.
  let ptr = HUD_INTEGRITY_STRIP_A;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const v = mem8[ptr];
    if (v !== mem8[u16(ptr - 0x20)]) throw new Error("animateActorGroupGrowShrink: mirror-bank slot mismatch (integrity guard)");
    sum = u16(sum + v);
    ptr = u16(ptr - 0x20);
  }

  // Step the cursor up into a second colour strip (high byte += 4) and fold 10 more rows into
  // the checksum, this time walking back downward (stride +0x20).
  ptr = u16(((((ptr >> 8) + 0x04) & 0xff) << 8) | (ptr & 0xff));
  for (let i = 0; i < 10; i++) {
    sum = u16(sum + mem8[ptr]);
    ptr = u16(ptr + 0x20);
  }

  // With intact data the running 16-bit checksum settles at exactly 0x012a. Either byte off is
  // tampering; both throws are unreachable with valid video RAM.
  if ((sum & 0xff) !== 0x2a) throw new Error("animateActorGroupGrowShrink: mirror-bank checksum low mismatch (integrity guard)");
  if (((sum >> 8) & 0xff) !== 0x01) throw new Error("animateActorGroupGrowShrink: mirror-bank checksum high mismatch (integrity guard)");
}
