// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  loc_5, loc_6, loc_7, loc_8, loc_13, loc_14, loc_15, loc_3e,
  loc_4c, loc_4d, loc_4e, loc_4f, loc_50, loc_52, loc_53, loc_a1, loc_b4,
  loc_117, loc_133, loc_406, loc_407, loc_408, loc_409, loc_40a, loc_40b,
  loc_4000, loc_4800, loc_5000, loc_5800,
  loc_c00, loc_60c8, loc_60cb, loc_60d8, loc_60db, loc_60e0, loc_d7dd,
} from "./names.js";
import { loc_cf24 } from "./loc_cf24.js";
import { loc_cd0a } from "./loc_cd0a.js";

// The periodic ~246Hz interrupt handler (the heartbeat). It guards against a corrupt stack or a negative
// heartbeat counter (both unreachable in the clock-free layer), then kicks the watchdog, advances the
// coarse frame counter from the spinner pot, folds the coin/switch inputs into edge state, drives the
// coin/LED output latch, picks a state code from a dispatch table by game phase, runs the two per-tick
// updaters, ticks the software timer cascades, pulses the vector generator when AVG-done is asserted, and
// latches the raw input port. Dispatched raw; the stack pointer is the only register read (the depth
// guard), and there is no register live-out.
export function loc_d704(m, s = m.regs.s) {
  const { mem8 } = m;

  // Stack-depth + heartbeat-sign guard. On failure the original takes a full reset. Both conditions are
  // unreachable in the clock-free layer: the stack pointer is retired (held at its reset value, never
  // pushed), and the heartbeat counter is kept in 0..~12 by the main loop, so it never goes negative.
  // If either ever trips it signals a genuine invariant break, surfaced here.
  const beat = mem8[loc_53];
  if (s < 0xd0 || (beat & 0x80) !== 0) {
    throw new Error("loc_d704: stack-depth/heartbeat guard tripped — a full RESET, unreachable in the SP-retired clock-free layer");
  }

  // Kick the watchdog and mirror the heartbeat into a POKEY register.
  mem8[loc_5000] = beat;
  mem8[loc_60cb] = beat;

  // Advance the coarse frame counter from the spinner pot: invert the pot, form a sign-extended
  // low-nibble delta vs the previous whole value, accumulate it into the fractional cell; the inverted
  // pot's bit4 lands in a flag cell.
  const pot = mem8[loc_60c8] ^ 0x0f;
  mem8[loc_117] = pot & 0x10;
  let a = (pot - mem8[loc_52]) & 0x0f;
  if (a >= 0x08) a |= 0xf0; // sign-extend the 4-bit delta
  a = u8(a + mem8[loc_50]);
  mem8[loc_50] = a;
  mem8[loc_52] = pot;
  mem8[loc_60db] = a;

  // Latch the raw input port, then fold this frame's coin/switch inputs against last frame's to track
  // pressed / newly-pressed edges.
  const potB = mem8[loc_60d8];
  mem8[loc_8] = mem8[loc_c00];
  let prev = mem8[loc_4c];
  mem8[loc_4c] = potB;
  a = (prev & mem8[loc_4c]) | mem8[loc_4d];
  mem8[loc_4d] = a;
  a = ((prev | mem8[loc_4c]) & mem8[loc_4d]);
  mem8[loc_4d] = a;
  const held = a;
  a = ((a ^ mem8[loc_4f]) & mem8[loc_4d]) | mem8[loc_4e];
  mem8[loc_4e] = a;
  mem8[loc_4f] = held;

  // Coin-counter / LED output latch: base flags plus one bit per active (negative) status byte.
  a = mem8[loc_b4];
  if ((mem8[loc_13] & 0x80) !== 0) a |= 0x04;
  if ((mem8[loc_14] & 0x80) !== 0) a |= 0x02;
  if ((mem8[loc_15] & 0x80) !== 0) a |= 0x01;
  mem8[loc_4000] = a;

  // Pick the dispatch index from the game phase: normally the phase cell +1; when the mode is idle,
  // 0 while the sub-timer is low, else the small counter (0/1) or a fixed 3.
  let x;
  if (mem8[loc_5] !== 0) x = u8(mem8[loc_3e] + 1);
  else if (mem8[loc_7] < 0x40) x = 0x00;
  else if (mem8[loc_6] < 0x02) x = mem8[loc_6];
  else x = 0x03;

  // Fold the table entry's low two bits into the state cell (mirrored to a POKEY register), high bits kept.
  a = ((mem8[u16(loc_d7dd + x)] ^ mem8[loc_a1]) & 0x03) ^ mem8[loc_a1];
  mem8[loc_a1] = a;
  mem8[loc_60e0] = a;

  loc_cf24(m);
  loc_cd0a(m);

  // Heartbeat + sub-timer ticks: the heartbeat always advances; the sub-timer advances and, only on its
  // wrap, drives the first carry cascade and (gated by the mode) the second.
  mem8[loc_53] = u8(mem8[loc_53] + 1);
  const t07 = u8(mem8[loc_7] + 1);
  mem8[loc_7] = t07;
  if (t07 === 0) {
    const t406 = u8(mem8[loc_406] + 1);
    mem8[loc_406] = t406;
    if (t406 === 0) {
      const t407 = u8(mem8[loc_407] + 1);
      mem8[loc_407] = t407;
      if (t407 === 0) mem8[loc_408] = u8(mem8[loc_408] + 1);
    }
    if ((mem8[loc_5] & 0x40) !== 0) {
      const t409 = u8(mem8[loc_409] + 1);
      mem8[loc_409] = t409;
      if (t409 === 0) {
        const t40a = u8(mem8[loc_40a] + 1);
        mem8[loc_40a] = t40a;
        if (t40a === 0) mem8[loc_40b] = u8(mem8[loc_40b] + 1);
      }
    }
  }

  // When the AVG-done input is asserted, bump the redraw counter and pulse the vector generator (reset
  // then go strobes; the hardware ignores the data written).
  if ((mem8[loc_c00] & 0x40) !== 0) {
    mem8[loc_133] = u8(mem8[loc_133] + 1);
    mem8[loc_5800] = 0;
    mem8[loc_4800] = 0;
  }
}
