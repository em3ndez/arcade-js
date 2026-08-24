// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { SPAWN_OBJECT_TABLE, WAVE_ARRIVAL_COUNTER, SHARED_FRAME_DELAY_TIMER, ANIM_TABLE_3838 } from "./names.js";
/**
 * descendEnemyActorAndSeatSpawnSlot — object descent step.
 *
 * Runs the animation sequencer, then advances the record's 16-bit sub-position (low +5, high +6)
 * by the step +9. While the high byte is still below the landing row it scans three spawn-object
 * slots for a free one whose row matches: on a hit it bumps the arrival counter, marks the slot
 * active, seats a biased X/Y and init byte, links the slot back into the record, and arms the seat
 * timer; finding none it returns without advancing. Either arm then bumps the state, reloads the
 * step to the row height, and re-arms the record's animation.
 *
 * LIVE-OUT: none consumed (memory only). The callees are memory-only; the scratch
 * registers are not read back by the per-frame dispatcher.
 */

const POS_LOW = 0x05; //   record offset: sub-position low byte (advanced by the step)
const POS_HIGH = 0x06; //  record offset: sub-position high byte / row
const STEP = 0x09; //      record offset: per-frame descent step (reloaded to ROW_HEIGHT)
const STATE = 0x02; //     record offset: state byte bumped once the row is reached
const X_SRC = 0x03; //     record offset: source X biased into the seated slot
const LINK_LO = 0x07; //   record offset: low byte of the seated slot's back-link
const LINK_HI = 0x08; //   record offset: high byte of the seated slot's back-link
const ROW_HEIGHT = 0x18; // landing-row height: scan threshold, slot stride, and reloaded step
const SLOT_ACTIVE_FLAG = 0x01;
const SLOT_ROW = 0x06;
const SLOT_X = 0x03;
const SLOT_X_HI = 0x04;
const SLOT_Y = 0x05;
const SLOT_Y_HI = 0x06;
const SLOT_INIT = 0x0f;
const SLOT_COUNT = 3; //   spawn-object slots scanned
const SLOT_SEATED = 0x02; // slot active marker written on seat
const SLOT_INIT_VALUE = 0xc0;
const X_BIAS = 0x80; //    subtracted from the source X (borrows into the high byte)
const Y_BIAS = 0x40; //    added to the source Y (carry decrements the high byte)
const SEAT_TIMER_SEED = 0x20; // value armed into the seat timer

export function descendEnemyActorAndSeatSpawnSlot(m, rec = m.regs.ix) {
  const { mem8 } = m;

  advanceObjectAnimationFrame(m, rec);

  const pos = mem8[rec + POS_LOW] + mem8[rec + STEP];
  if (pos > 0xff) mem8[rec + POS_HIGH] = (mem8[rec + POS_HIGH] + 1);
  mem8[rec + POS_LOW] = pos;

  if (mem8[rec + POS_HIGH] < ROW_HEIGHT) {
    let slot = SPAWN_OBJECT_TABLE;
    let seated = false;
    for (let i = 0; i < SLOT_COUNT; i++) {
      if (mem8[slot + SLOT_ACTIVE_FLAG] === 0 && mem8[slot + SLOT_ROW] === mem8[rec + POS_HIGH]) {
        seated = true;
        break;
      }
      slot += ROW_HEIGHT;
    }
    if (!seated) return; // no free matching slot -> nothing seated

    mem8[WAVE_ARRIVAL_COUNTER] = (mem8[WAVE_ARRIVAL_COUNTER] + 1);
    mem8[slot + SLOT_ACTIVE_FLAG] = SLOT_SEATED;

    const x = mem8[rec + X_SRC] - X_BIAS;
    if (x < 0) mem8[slot + SLOT_X_HI] = (mem8[slot + SLOT_X_HI] - 1); // borrow
    mem8[slot + SLOT_X] = x;

    const y = mem8[rec + POS_LOW] + Y_BIAS;
    if (y > 0xff) mem8[slot + SLOT_Y_HI] = (mem8[slot + SLOT_Y_HI] - 1); // carry decrements
    mem8[slot + SLOT_Y] = y;

    mem8[slot + SLOT_INIT] = SLOT_INIT_VALUE;
    mem8[rec + LINK_LO] = slot;
    mem8[rec + LINK_HI] = (slot >> 8);
    mem8[SHARED_FRAME_DELAY_TIMER] = SEAT_TIMER_SEED;
  }

  mem8[rec + STATE] = (mem8[rec + STATE] + 1);
  mem8[rec + STEP] = ROW_HEIGHT;
  setActorAnimation(m, rec, ANIM_TABLE_3838);
}
