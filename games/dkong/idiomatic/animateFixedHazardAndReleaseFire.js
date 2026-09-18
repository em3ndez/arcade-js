// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateFixedHazardAndReleaseFire — on each main-loop pass, animates the board's fixed hazard
 * object and, once its arm counter underflows, requests release of a new fire. Runs only when the
 * board test, the alive test, and the event gate all open; then a prescaler and a two-arm phase
 * state machine drive the flag/sprite stamps and down-counters.
 *
 * LIVE-OUT: memory-only.
 */

import { OBJ_RECORD_66A0, EVENT_REQ_313C, OBJ_HIT_EXTENT_X, OBJ_HIT_EXTENT_Y } from "./names.js";
import { boardBitGate } from "./boardBitGate.js";
import { marioActiveGuard } from "./marioActiveGuard.js";
import { loc_03f2 } from "./loc_03f2.js";

const BOARD_MASK = 0x03;   // applicability mask for the board test: bit0 25m, bit1 50m
const EVENT_GATE = 0x6350; // bit0 SET -> skip this pass
const PRESCALER = 0x62b8;  // 4-frame prescaler; reloaded to 4 on underflow, else returns
const PHASE_BITS = 0x62b9; // bit0 SET -> continue; bit1 selects the sprite arm
const ARM_COUNTER = 0x62ba;// bit1-arm down-counter; on underflow re-arms PHASE_BITS
const SPRITE_DEST = 0x6a29; // where the jittered sprite byte lands, inside the sprite buffer
const SPRITE_BYTE_A = 0x40; // the sprite byte on the bit1-clear arm
const SPRITE_BYTE_B = 0x42; // the sprite byte on the bit1-set arm

export function animateFixedHazardAndReleaseFire(m) {
  const { regs, mem8 } = m;

  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return; // closed on 75m/100m -> skip the whole routine

  if (!marioActiveGuard(m)) return; // Mario dead -> skip

  if ((mem8[EVENT_GATE] & 0x01) !== 0) return;

  const dec = (mem8[PRESCALER] - 1) & 0xff;
  mem8[PRESCALER] = dec;
  if (dec !== 0) return;

  mem8[PRESCALER] = 0x04;
  const phase = mem8[PHASE_BITS];

  if ((phase & 0x01) === 0) return;

  if ((phase & 0x02) === 0) {
    mem8[(OBJ_RECORD_66A0 + OBJ_HIT_EXTENT_X) & 0xffff] = 0x02;
    mem8[(OBJ_RECORD_66A0 + OBJ_HIT_EXTENT_Y) & 0xffff] = 0x00;
    loc_03f2(m, SPRITE_DEST, SPRITE_BYTE_A);
  } else {
    mem8[(OBJ_RECORD_66A0 + OBJ_HIT_EXTENT_X) & 0xffff] = 0x02;
    mem8[(OBJ_RECORD_66A0 + OBJ_HIT_EXTENT_Y) & 0xffff] = 0x02;
    loc_03f2(m, SPRITE_DEST, SPRITE_BYTE_B);

    const decB = (mem8[ARM_COUNTER] - 1) & 0xff;
    mem8[ARM_COUNTER] = decB;
    if (decB !== 0) return;

    mem8[PHASE_BITS] = 0x01;
    mem8[EVENT_REQ_313C] = 0x01;
  }

  mem8[ARM_COUNTER] = 0x10;
}
