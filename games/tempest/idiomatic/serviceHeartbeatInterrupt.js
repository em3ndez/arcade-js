// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  STATUS_FLAGS, PHASE_COUNTER, IRQ_SUBTIMER, INPUT_PORT_LATCH, LANE_COUNTER, LANE_COUNTER_1, LANE_COUNTER_2, ACTIVE_SLOT_COUNT,
  INPUT_CUR, INPUT_DEBOUNCED, INPUT_EDGE_FLAGS, INPUT_PREV, SPINNER_ACCUM, SPINNER_POT_PREV, IRQ_HEARTBEAT, VG_MODE_FLAG, VG_SCALE,
  loc_117, LEVEL_LAYOUT_TRIGGER, TIMER1_LO, TIMER1_MID, TIMER1_HI, TIMER2_LO, TIMER2_MID, TIMER2_HI,
  COIN_FLIP_LATCH, AVG_GO_STROBE, WATCHDOG_CLEAR, AVG_RESET_STROBE,
  IN0_PORT, POKEY1_AUDCTL, POKEY1_POTGO, POKEY2_AUDCTL, POKEY2_POTGO, LED_FLIP_LATCH, IRQ_STATE_CODE,
} from "./names.js";
import { tickHeartbeatCounters } from "./tickHeartbeatCounters.js";
import { stepSoundVoices } from "./stepSoundVoices.js";

/**
 * serviceHeartbeatInterrupt — the periodic ~246Hz timer interrupt handler (the heartbeat). ROM 0xd704.
 *
 * Role in the machine: this is Tempest's clock. On the real board it fires from the 3kHz/12 timer IRQ
 * and does all the fixed-cadence housekeeping the main loop cannot: it kicks the watchdog so the board
 * does not reset, integrates the spinner pot into the coarse frame counter that rotates the player around
 * the rim, debounces the coin/start/switch inputs into pressed/edge state, drives the coin-counter and
 * LED output latch, selects a vector-generator state code by game phase, runs the two per-tick updaters
 * (heartbeat counters and the sound voices), advances the software timer cascades, and pulses the vector
 * generator to redraw the screen once the AVG reports done.
 *
 * Behavior: first a stack-depth + heartbeat-sign guard (both unreachable in this SP-retired clock-free
 * layer; a trip means a real invariant break). Kick WATCHDOG_CLEAR and mirror the beat to a POKEY reg.
 * Invert the spinner pot, form a sign-extended low-nibble delta vs the previous value, accumulate it into
 * SPINNER_ACCUM and stash the pot's bit4 into loc_117. Latch the raw input port, then fold this frame's
 * inputs against last frame's to maintain debounced/held/edge cells. Build the coin/LED latch from base
 * flags plus one bit per active (negative) lane-counter status byte. Pick a dispatch index from the game
 * phase and fold the table entry's low two bits into the VG mode cell. Run tickHeartbeatCounters and
 * stepSoundVoices. Advance the heartbeat and sub-timer; on the sub-timer wrap drive the first carry
 * cascade and (mode-gated) the second. Finally, on AVG-done bump the redraw counter and strobe the VG.
 *
 * Live-out: SPINNER_ACCUM/SPINNER_POT_PREV/loc_117, the input debounce/edge cells, COIN_FLIP_LATCH,
 * VG_MODE_FLAG/LED_FLIP_LATCH, IRQ_HEARTBEAT/IRQ_SUBTIMER and the TIMER1/TIMER2 cascades, INPUT_PORT_LATCH,
 * LEVEL_LAYOUT_TRIGGER, and the hardware strobe latches. Dispatched raw; the stack pointer is the only
 * register read (the depth guard) and there is no register live-out.
 *
 * Grounding: [seen]
 */
export function serviceHeartbeatInterrupt(m, s = m.regs.s) {
  const { mem8 } = m;

  // Stack-depth + heartbeat-sign guard. On failure the original takes a full reset. Both conditions are
  // unreachable in the clock-free layer: the stack pointer is retired (held at its reset value, never
  // pushed), and the heartbeat counter is kept in 0..~12 by the main loop, so it never goes negative.
  // If either ever trips it signals a genuine invariant break, surfaced here.
  const beat = mem8[IRQ_HEARTBEAT];
  if (s < 0xd0 || (beat & 0x80) !== 0) {
    throw new Error("serviceHeartbeatInterrupt: stack-depth/heartbeat guard tripped — a full RESET, unreachable in the SP-retired clock-free layer");
  }

  // Kick the watchdog and mirror the heartbeat into a POKEY register.
  mem8[WATCHDOG_CLEAR] = beat;
  mem8[POKEY1_POTGO] = beat;

  // Advance the coarse frame counter from the spinner pot: invert the pot, form a sign-extended
  // low-nibble delta vs the previous whole value, accumulate it into the fractional cell; the inverted
  // pot's bit4 lands in a flag cell.
  const pot = mem8[POKEY1_AUDCTL] ^ 0x0f;
  mem8[loc_117] = pot & 0x10;
  let a = (pot - mem8[SPINNER_POT_PREV]) & 0x0f;
  if (a >= 0x08) a |= 0xf0; // sign-extend the 4-bit delta
  a = u8(a + mem8[SPINNER_ACCUM]);
  mem8[SPINNER_ACCUM] = a;
  mem8[SPINNER_POT_PREV] = pot;
  mem8[POKEY2_POTGO] = a;

  // Latch the raw input port, then fold this frame's coin/switch inputs against last frame's to track
  // pressed / newly-pressed edges.
  const potB = mem8[POKEY2_AUDCTL];
  mem8[INPUT_PORT_LATCH] = mem8[IN0_PORT];
  let prev = mem8[INPUT_CUR];
  mem8[INPUT_CUR] = potB;
  a = (prev & mem8[INPUT_CUR]) | mem8[INPUT_DEBOUNCED];
  mem8[INPUT_DEBOUNCED] = a;
  a = ((prev | mem8[INPUT_CUR]) & mem8[INPUT_DEBOUNCED]);
  mem8[INPUT_DEBOUNCED] = a;
  const held = a;
  a = ((a ^ mem8[INPUT_PREV]) & mem8[INPUT_DEBOUNCED]) | mem8[INPUT_EDGE_FLAGS];
  mem8[INPUT_EDGE_FLAGS] = a;
  mem8[INPUT_PREV] = held;

  // Coin-counter / LED output latch: base flags plus one bit per active (negative) status byte.
  a = mem8[VG_SCALE];
  if ((mem8[LANE_COUNTER] & 0x80) !== 0) a |= 0x04;
  if ((mem8[LANE_COUNTER_1] & 0x80) !== 0) a |= 0x02;
  if ((mem8[LANE_COUNTER_2] & 0x80) !== 0) a |= 0x01;
  mem8[COIN_FLIP_LATCH] = a;

  // Pick the dispatch index from the game phase: normally the phase cell +1; when the mode is idle,
  // 0 while the sub-timer is low, else the small counter (0/1) or a fixed 3.
  let x;
  if (mem8[STATUS_FLAGS] !== 0) x = u8(mem8[ACTIVE_SLOT_COUNT] + 1);
  else if (mem8[IRQ_SUBTIMER] < 0x40) x = 0x00;
  else if (mem8[PHASE_COUNTER] < 0x02) x = mem8[PHASE_COUNTER];
  else x = 0x03;

  // Fold the table entry's low two bits into the state cell (mirrored to a POKEY register), high bits kept.
  a = ((mem8[u16(IRQ_STATE_CODE + x)] ^ mem8[VG_MODE_FLAG]) & 0x03) ^ mem8[VG_MODE_FLAG];
  mem8[VG_MODE_FLAG] = a;
  mem8[LED_FLIP_LATCH] = a;

  tickHeartbeatCounters(m);
  stepSoundVoices(m);

  // Heartbeat + sub-timer ticks: the heartbeat always advances; the sub-timer advances and, only on its
  // wrap, drives the first carry cascade and (gated by the mode) the second.
  mem8[IRQ_HEARTBEAT] = u8(mem8[IRQ_HEARTBEAT] + 1);
  const t07 = u8(mem8[IRQ_SUBTIMER] + 1);
  mem8[IRQ_SUBTIMER] = t07;
  if (t07 === 0) {
    const t406 = u8(mem8[TIMER1_LO] + 1);
    mem8[TIMER1_LO] = t406;
    if (t406 === 0) {
      const t407 = u8(mem8[TIMER1_MID] + 1);
      mem8[TIMER1_MID] = t407;
      if (t407 === 0) mem8[TIMER1_HI] = u8(mem8[TIMER1_HI] + 1);
    }
    if ((mem8[STATUS_FLAGS] & 0x40) !== 0) {
      const t409 = u8(mem8[TIMER2_LO] + 1);
      mem8[TIMER2_LO] = t409;
      if (t409 === 0) {
        const t40a = u8(mem8[TIMER2_MID] + 1);
        mem8[TIMER2_MID] = t40a;
        if (t40a === 0) mem8[TIMER2_HI] = u8(mem8[TIMER2_HI] + 1);
      }
    }
  }

  // When the AVG-done input is asserted, bump the redraw counter and pulse the vector generator (reset
  // then go strobes; the hardware ignores the data written).
  if ((mem8[IN0_PORT] & 0x40) !== 0) {
    mem8[LEVEL_LAYOUT_TRIGGER] = u8(mem8[LEVEL_LAYOUT_TRIGGER] + 1);
    mem8[AVG_RESET_STROBE] = 0;
    mem8[AVG_GO_STROBE] = 0;
  }
}
