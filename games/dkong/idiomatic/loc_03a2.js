// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_03a2 — a periodic event, serviced only when three gates in a row pass.  ROM 0x03A2.
 *
 * Called every main-loop pass (mainLoop_02bd `call 0x03a2`). It does nothing at all
 * unless THREE guards open, one after another, and only then runs a small state machine
 * that stamps two object-flag bytes, stores a jittered sprite byte via loc_03f2, and
 * steps its own down-counters.
 *
 * The three entry gates, in order:
 *   1. rst 0x30 (boardBitGate) with mask 0x03 — the board must be 25m or 50m (bit0/bit1
 *      of the mask). On 75m/100m the gate is closed and the whole routine is skipped.
 *   2. rst 0x10 (marioActiveGuard) — Mario must be alive.
 *   3. bit0 of (0x6350) must be CLEAR (the oracle's `rrca / ret c`).
 * Then a 4-frame prescaler at 0x62B8: it is decremented every pass and the routine
 * returns until it underflows, at which point it is reloaded to 4 and the body runs.
 *
 * The body reads (0x62B9): bit0 must be SET to continue (else return); bit1 then selects
 * one of two nearly identical arms. Both stamp OBJ_HIT_EXTENT_X (+0x09) of the OBJ_RECORD_66A0 block
 * to 0x02 and store a sprite byte at 0x6A29 through loc_03f2 (which jitters it ±1 on the
 * spin low bit); they differ only in byte +0x0A (0x00 vs 0x02) and the stored sprite byte
 * (0x40 vs 0x42). The bit1-set arm additionally runs a second down-counter at 0x62BA and,
 * on its underflow, sets (0x62B9) and EVENT_REQ_313C to 1 — re-arming the bit0 gate. Both arms
 * converge on writing 0x10 into that second counter (0x62BA) before returning.
 *
 * REGISTER-ABI MARSHALLING (dissolves once the callees take honest args): the three
 * callees still read their inputs from registers, so this routine loads exactly what the
 * oracle's `call` sites load — regs.a = 0x03 before boardBitGate (the board mask), nothing
 * before marioActiveGuard (it reads only RAM), and regs.hl = 0x6A29 / regs.b = 0x40 (arm A)
 * or 0x42 (arm B) before loc_03f2 (its destination pointer and byte).
 *
 * NAME: kept the neutral loc_ — the mechanics are pinned to the oracle, but which game
 * event this services (and what its cells mean semantically) is not confirmed to the
 * routine-name bar. Promote once corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-03a2.test.js.
 * GATE:     capture/clone/replay of real attract dispatches plus crafted entries that
 *           drive each of the three gate-closed skips, both early-out counters, and both
 *           sprite arms (bit1 clear/set) with the spin bit both ways; the RAM diff excludes
 *           the dead STACK_SCRATCH the oracle's push16/ret churn writes. Teeth: a twin that
 *           drops the reload-to-4 and a twin that stamps the wrong +0x0A byte.
 * LIVE-OUT: memory-only. The oracle's residual registers/flags and its terminal `ret` are
 *           dead ABI — mainLoop_02bd issues its next `call` without reading them; the
 *           boolean-guard returns replace the rst-0x30/rst-0x10 stack skip idiom.
 * NAMES:    boardBitGate (ROM 0x0030, reads BOARD 0x6227 + regs.a), marioActiveGuard
 *           (ROM 0x0010, reads MARIO_ACTIVE 0x6200), loc_03f2 (ROM 0x03F2, reads SPIN_COUNT
 *           0x6019 + regs.hl/regs.b) — all direct-called. Every cell THIS routine touches
 *           directly was examined against ram.js. NAMED there: OBJ_RECORD_66A0 (whose +9/+A
 *           are OBJ_HIT_EXTENT_X/Y) and EVENT_REQ_313C (0x63A0). Genuinely UNNAMED and kept
 *           as local hex consts: 0x6350, 0x62B8, 0x62B9, 0x62BA, 0x6A29 (thin/shared/no-reader).
 */

import { OBJ_RECORD_66A0, EVENT_REQ_313C, OBJ_HIT_EXTENT_X, OBJ_HIT_EXTENT_Y } from "./ram.js";
import { boardBitGate } from "./boardBitGate.js";       // ROM 0x0030 (rst 0x30)
import { marioActiveGuard } from "./marioActiveGuard.js"; // ROM 0x0010 (rst 0x10)
import { loc_03f2 } from "./loc_03f2.js";               // ROM 0x03F2

const BOARD_MASK = 0x03;   // rst-0x30 applicability mask: bit0 25m, bit1 50m
const EVENT_GATE = 0x6350; // bit0 SET -> skip this pass (the oracle's `ret c`)
const PRESCALER = 0x62b8;  // 4-frame prescaler; reloaded to 4 on underflow, else returns
const PHASE_BITS = 0x62b9; // bit0 SET -> continue; bit1 selects the sprite arm
const ARM_COUNTER = 0x62ba;// bit1-arm down-counter; on underflow re-arms PHASE_BITS
const SPRITE_DEST = 0x6a29; // loc_03f2 destination (a cell inside SPRITE_BUFFER)
const SPRITE_BYTE_A = 0x40; // loc_03f2 byte on the bit1-clear arm
const SPRITE_BYTE_B = 0x42; // loc_03f2 byte on the bit1-set arm (0x40 + inc + inc)

export function loc_03a2(m) {
  const { regs, mem } = m;

  // Gate 1 — rst 0x30 board test. boardBitGate reads the mask from regs.a.
  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return; // closed on 75m/100m -> skip the whole routine

  // Gate 2 — rst 0x10 alive test (reads MARIO_ACTIVE, no register input).
  if (!marioActiveGuard(m)) return; // Mario dead -> skip

  // Gate 3 — bit0 of (0x6350): the oracle's `rrca / ret c` returns when it is SET.
  if ((mem.read8(EVENT_GATE) & 0x01) !== 0) return;

  // 4-frame prescaler: decrement; return until it underflows to 0.
  const dec = (mem.read8(PRESCALER) - 1) & 0xff;
  mem.write8(PRESCALER, dec);
  if (dec !== 0) return;

  // Underflowed: reload to 4, then read the phase byte (order preserved — the reload
  // write happens before the phase read, mirroring `ld (hl),0x04 / ld a,(0x62b9)`).
  mem.write8(PRESCALER, 0x04);
  const phase = mem.read8(PHASE_BITS);

  // Continuation gate: bit0 must be SET (the oracle's second `rrca` then `ret nc`).
  if ((phase & 0x01) === 0) return;

  // bit1 selects the arm (the third `rrca` then `jp nc`): CLEAR -> arm A, SET -> arm B.
  if ((phase & 0x02) === 0) {
    // Arm A (ROM 0x03E4): flags {+9:0x02, +A:0x00}, sprite byte 0x40.
    mem.write8((OBJ_RECORD_66A0 + OBJ_HIT_EXTENT_X) & 0xffff, 0x02);
    mem.write8((OBJ_RECORD_66A0 + OBJ_HIT_EXTENT_Y) & 0xffff, 0x00);
    regs.hl = SPRITE_DEST;
    regs.b = SPRITE_BYTE_A;
    loc_03f2(m);
  } else {
    // Arm B (ROM 0x03C4): flags {+9:0x02, +A:0x02}, sprite byte 0x42.
    mem.write8((OBJ_RECORD_66A0 + OBJ_HIT_EXTENT_X) & 0xffff, 0x02);
    mem.write8((OBJ_RECORD_66A0 + OBJ_HIT_EXTENT_Y) & 0xffff, 0x02);
    regs.hl = SPRITE_DEST;
    regs.b = SPRITE_BYTE_B;
    loc_03f2(m);

    // Second down-counter: decrement; return until it underflows.
    const decB = (mem.read8(ARM_COUNTER) - 1) & 0xff;
    mem.write8(ARM_COUNTER, decB);
    if (decB !== 0) return;

    // On underflow, re-arm the bit0 gate and mirror it into (0x63A0).
    mem.write8(PHASE_BITS, 0x01);
    mem.write8(EVENT_REQ_313C, 0x01);
  }

  // loc_03de — both arms converge: reload the second counter to 0x10.
  mem.write8(ARM_COUNTER, 0x10);
}
