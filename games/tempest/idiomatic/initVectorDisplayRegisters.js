// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  EAROM_DATA, MATHBOX_STATUS, EAROM_READ, MATHBOX_RESULT_LO, MATHBOX_RESULT_HI, MATHBOX_LD_R0_LO,
  POKEY1_AUDF1, POKEY2_AUDF1, LED_FLIP_LATCH,
} from "./names.js";
import { emitCoordinateVectorWord } from "./emitCoordinateVectorWord.js";

/**
 * initVectorDisplayRegisters -- cold-reset the $60xx hardware register bank. ROM 0xdb22.
 *
 * Role in the machine: the $60xx page is Tempest's memory-mapped hardware -- the mathbox (the analog
 * vector math coprocessor), the two POKEY sound chips, the EAROM (the non-volatile high-score store),
 * and the LED/coin latch. This routine brings that bank to a known state at startup: it zeroes the
 * control latches, performs the dummy reads the hardware needs to settle, primes a scratch table, and
 * emits one framing vector word.
 *
 * Behavior: write zero to the LED/flip latch 0x60e0, the mathbox R0-low load 0x6080, both POKEY AUDF1
 * pitch registers 0x60c0/0x60d0, the EAROM data latch 0x6000, and the mathbox status 0x6040. Then take
 * four settling reads whose values are discarded (the `void` reads) -- mathbox status, the two mathbox
 * result bytes, and the EAROM read latch -- so the hardware flip-flops settle. Raise the LED/flip latch
 * 0x60e0 to 0x08. Next march a single set bit across the 32 slots at 0x6080: starting with bit = 0x01,
 * for X from 0x1f down to 0, write the current bit pattern, then rotate it left through a carry chain
 * (the 6502 ROL), so a lone 1 walks up the byte and re-enters as it overflows. Finally emit one framing
 * coordinate word via emitCoordinateVectorWord(0x34, 0xa6).
 *
 * Live-out: the reset $60xx latches (LED/flip 0x60e0=0x08, zeroed mathbox/POKEY/EAROM control), the
 * 32-slot bit-march table at 0x6080, and the emitted framing vector word. Grounding: [seen].
 */
export function initVectorDisplayRegisters(m) {
  const { mem8 } = m;

  mem8[LED_FLIP_LATCH] = 0x00;      // 0x60e0 LED/flip/coin latch
  mem8[MATHBOX_LD_R0_LO] = 0x00;    // 0x6080 mathbox R0-low load
  mem8[POKEY1_AUDF1] = 0x00;        // 0x60c0 POKEY 1 pitch
  mem8[POKEY2_AUDF1] = 0x00;        // 0x60d0 POKEY 2 pitch
  mem8[EAROM_DATA] = 0x00;          // 0x6000 EAROM data latch
  mem8[MATHBOX_STATUS] = 0x00;      // 0x6040 mathbox status

  // Four dummy reads to let the hardware flip-flops settle (values discarded).
  void mem8[MATHBOX_STATUS];
  void mem8[MATHBOX_RESULT_LO];
  void mem8[MATHBOX_RESULT_HI];
  void mem8[EAROM_READ];

  mem8[LED_FLIP_LATCH] = 0x08;      // raise the LED/flip latch

  // March a single set bit across the 32 slots at 0x6080 (ROL carry chain).
  let bit = 0x01;
  let carry = 0;
  for (let x = 0x1f; x >= 0; x--) {
    mem8[u16(MATHBOX_LD_R0_LO + x)] = bit;
    const nextCarry = (bit >> 7) & 1;        // save the bit rotating out of the top
    bit = ((bit << 1) | carry) & 0xff;       // rotate left through carry
    carry = nextCarry;
  }

  emitCoordinateVectorWord(m, 0x34, 0xa6);   // one framing word
}
