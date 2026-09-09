// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { advanceAllSegmentColumns } from "./advanceAllSegmentColumns.js";
import {
  IN0,
  loc_d5,
  PALETTE_COLOR_04,
  loc_1c00,
  loc_c5,
  loc_2003,
  loc_bd,
  TRACKBALL_LAST_DELTA,
  loc_b9,
  IRQ_ACK,
  STACK_SCRATCH,
} from "./names.js";

/**
 * accumulateTrackballAndReturnFromIrq — the interrupt tail. ROM 0x2c00 (IRQ handler body).
 *
 * Role in the machine: Centipede's player control is a trackball read by an interrupt-time integrator.
 * On the real board this code runs from the periodic IRQ; the JS port drives it as a direct call. Every
 * interrupt it reads the two raw hardware trackball counters, converts each into a small signed movement,
 * filters out spurious reversals, and adds the result into a per-axis position accumulator ($b9/$ba) that
 * the game later consumes to move the player's shooter. It also carries the board self-test's diagnostic
 * work, which shares the same interrupt.
 *
 * Off self-test it advances the $d5 diagnostic counter and ramps the four diag colour cells; under
 * self-test it emits the output latches and folds a table checksum. Then, for the two axes, it folds each
 * raw counter's signed nibble delta into the per-axis accumulator ($b9/$ba,X), acks the interrupt, and
 * returns.
 *
 * Live-out: the two-axis position accumulators $b9/$bb, the last-sample cells $bd/$bf, the hysteresis
 * reference $ba/$bc, the IRQ acknowledge latch, and (self-test only) the output latches / diag colours /
 * $d5 counter. Fired as a direct call, it restores no frame. Grounding: [code].
 */
export function accumulateTrackballAndReturnFromIrq(m) {
  const { mem8 } = m;
  const io = mem8[IN0];

  // Branch on the service/self-test bit (IN0 bit 5). Held low by an operator only during the board test.
  if (io & 0x20) {
    // Self-test active. This arm has nothing to do with player control: it exercises the board. It runs
    // the segment-column spine as a liveness check, copies the three $c5 progress cells out to the $1c00
    // output latch (so the tester can watch them on the port), then XOR-folds an 11-byte table at $2003
    // into a running checksum seeded with 0xf4.
    // Self-test active: run the spine service, mirror $c5,X to the output latch, then fold a table checksum.
    advanceAllSegmentColumns(m);
    for (let x = 2; x >= 0; x--) mem8[u16(loc_1c00 + x)] = mem8[u8(loc_c5 + x)];
    let sum = 0xf4;
    for (let x = 0x0a; x >= 0; x--) sum ^= mem8[u16(loc_2003 + x)];
    sum = u8(sum);
    // A good ROM image folds to zero. A nonzero checksum means the table was tampered with; the original
    // stashed a 3 at the top of the stack page as a marker. The stack pointer is retired in this port, so
    // the fixed stack-top slot is written directly -- it is dead scratch either way, kept only for fidelity.
    // Tamper-only marker (the checksum passes on a good image): a 3 is stashed at the stack top. SP is
    // retired, so write the fixed stack-top slot directly -- dead scratch either way.
    if (sum !== 0) mem8[STACK_SCRATCH.hi - 1] = 3;
  } else {
    // Normal operation: advance the $d5 diagnostic frame counter (bit 7 clear means still counting) and
    // paint a moving colour ramp so the diagnostic screen shows life.
    let d5 = mem8[loc_d5];
    if ((d5 & 0x80) === 0) {
      d5 = u8(d5 + 1);
      mem8[loc_d5] = d5;
      if (mem8[IN0] & 0x40) { d5 = 0x00; mem8[loc_d5] = d5; } // 32V edge resets the counter
      // Ramp four consecutive palette cells starting from $1404. The seed is d5<<2; each successive cell
      // is +1, with the carry chain seeded from the bit shifted out of the top of d5 -- exactly the 6502's
      // ASL-then-ADC sequence, so the colours sweep smoothly frame over frame.
      // Ramp the four diag colour cells from d5<<2, carrying +1 up the run (carry seeded by the shift-out).
      let a = u8(d5 << 2);
      let carry = (d5 >> 6) & 1;
      for (let x = 3; x >= 0; x--) {
        mem8[u16(PALETTE_COLOR_04 + x)] = a;
        const next = a + 1 + carry;
        a = u8(next);
        carry = next > 0xff ? 1 : 0;
      }
    }
  }

  // The trackball integrator proper. Two axes are serviced, X = 2 (one axis) then X = 0 (the other). Each
  // axis has a raw 4-bit up/down counter in the hardware read at $c00+x; the game keeps last frame's raw
  // value in $bd+x and takes the difference to learn how far the ball rolled since the previous interrupt.
  // Per-axis (X = 2 then 0): signed nibble delta of the raw counter, hysteresis-filtered, into $b9,X.
  let a = 0;
  for (let x = 2; x >= 0; x -= 2) {
    const raw = mem8[u16(IN0 + x)];
    a = u8(raw - mem8[u8(loc_bd + x)]); // delta since last sample
    mem8[u8(loc_bd + x)] = raw;
    // The counter is only 4 bits, so keep the low nibble and sign-extend it: a nibble >= 8 is a negative
    // movement (the ball rolled the other way), turned into a full-width negative byte with the 0xf0 fill.
    a = a & 0x0f;
    if (a >= 8) a = a | 0xf0;           // sign-extend the negative nibble
    let y = a;
    if (a !== 0) {
      // Hysteresis / anti-jitter filter. If this delta's sign differs from the last committed delta
      // ($ba+x) AND it also disagrees with the sign of the current raw reading, treat it as a spurious
      // reversal (electrical noise on the counter) and substitute the previously committed delta instead.
      if ((a ^ mem8[u8(TRACKBALL_LAST_DELTA + x)]) & 0x80) {          // sign flip vs last committed delta
        if ((y ^ mem8[u16(IN0 + x)]) & 0x80) y = mem8[u8(TRACKBALL_LAST_DELTA + x)]; // reject a reversal
      }
      // Commit: remember this delta as the hysteresis reference and add it into the axis position
      // accumulator $b9+x that the game reads to move the player.
      mem8[u8(TRACKBALL_LAST_DELTA + x)] = y;
      a = u8(y + mem8[u8(loc_b9 + x)]);
      mem8[u8(loc_b9 + x)] = a;
    }
  }
  // Acknowledge the interrupt so the hardware can raise the next one. The written value is incidental.
  mem8[IRQ_ACK] = a; // interrupt acknowledge
  // Fired as a direct JS call (SP retired): no saved register frame to restore and no rti -- just return.
}
