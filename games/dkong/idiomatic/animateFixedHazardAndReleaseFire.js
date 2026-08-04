// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateFixedHazardAndReleaseFire — animate the board's fixed hazard object and, when the armed
 * arm's counter runs out, request the release of a new fire.
 *
 * It is called on every main-loop pass and does nothing at all unless THREE guards open one after
 * another. Only then does it run a small state machine that stamps two of the hazard record's flag
 * bytes, stores a jittered sprite byte, and steps its own down-counters.
 *
 * The three entry gates, in order:
 *   1. The board test, with the 25m and 50m bits: on 75m and 100m the gate is closed and the whole
 *      routine is skipped.
 *   2. The alive test — Mario must be alive.
 *   3. Bit 0 of the event gate must be CLEAR.
 * Then a 4-frame prescaler: it is decremented every pass and the routine returns until it
 * underflows, at which point it is reloaded to 4 and the body runs.
 *
 * The body reads the phase byte. Bit 0 must be SET to continue, or it returns; bit 1 then selects
 * one of two nearly identical arms. Both stamp OBJ_HIT_EXTENT_X of the hazard record to 2 and
 * store a sprite byte through the jittered-sprite store, which nudges the byte by ±1 on the low
 * bit of the spin counter. The arms differ only in OBJ_HIT_EXTENT_Y (0 versus 2) and the stored
 * sprite byte (0x40 versus 0x42). The bit-1-set arm additionally runs a second down-counter and,
 * on its underflow, sets the phase byte's bit 0 again and raises EVENT_REQ_313C — which is what
 * makes a fire come out, one step later and elsewhere. Both arms converge on reloading that second
 * counter to 0x10 before returning.
 *
 * The three callees still take their inputs in registers, so this routine stages the board mask
 * before the board test, and the destination pointer and sprite byte before each store; the alive
 * test reads only memory and takes nothing.
 *
 * NOT CLAIMED: how the released object behaves once it has been inserted.
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
  const { regs, mem } = m;

  // Gate 1 — the board test, which reads its mask from a register.
  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return; // closed on 75m/100m -> skip the whole routine

  // Gate 2 — the alive test, which reads MARIO_ACTIVE and takes no input.
  if (!marioActiveGuard(m)) return; // Mario dead -> skip

  // Gate 3 — the event gate: return when its bit 0 is SET.
  if ((mem.read8(EVENT_GATE) & 0x01) !== 0) return;

  // 4-frame prescaler: decrement; return until it underflows to 0.
  const dec = (mem.read8(PRESCALER) - 1) & 0xff;
  mem.write8(PRESCALER, dec);
  if (dec !== 0) return;

  // Underflowed: reload to 4, then read the phase byte. The reload write happens before the phase
  // read, and that order is preserved.
  mem.write8(PRESCALER, 0x04);
  const phase = mem.read8(PHASE_BITS);

  // Continuation gate: bit0 must be SET.
  if ((phase & 0x01) === 0) return;

  // bit1 selects the arm: CLEAR -> arm A, SET -> arm B.
  if ((phase & 0x02) === 0) {
    // Arm A: extents {X:0x02, Y:0x00}, sprite byte 0x40.
    mem.write8((OBJ_RECORD_66A0 + OBJ_HIT_EXTENT_X) & 0xffff, 0x02);
    mem.write8((OBJ_RECORD_66A0 + OBJ_HIT_EXTENT_Y) & 0xffff, 0x00);
    regs.hl = SPRITE_DEST;
    regs.b = SPRITE_BYTE_A;
    loc_03f2(m);
  } else {
    // Arm B: extents {X:0x02, Y:0x02}, sprite byte 0x42.
    mem.write8((OBJ_RECORD_66A0 + OBJ_HIT_EXTENT_X) & 0xffff, 0x02);
    mem.write8((OBJ_RECORD_66A0 + OBJ_HIT_EXTENT_Y) & 0xffff, 0x02);
    regs.hl = SPRITE_DEST;
    regs.b = SPRITE_BYTE_B;
    loc_03f2(m);

    // Second down-counter: decrement; return until it underflows.
    const decB = (mem.read8(ARM_COUNTER) - 1) & 0xff;
    mem.write8(ARM_COUNTER, decB);
    if (decB !== 0) return;

    // On underflow, re-arm the phase byte's bit 0 and raise the release request.
    mem.write8(PHASE_BITS, 0x01);
    mem.write8(EVENT_REQ_313C, 0x01);
  }

  // Both arms converge: reload the second counter to 0x10.
  mem.write8(ARM_COUNTER, 0x10);
}
