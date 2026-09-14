// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  PHASE_COUNTER, IRQ_SUBTIMER, INPUT_PORT_LATCH, DSW1_SNAPSHOT, SOUND_STEP_GATE, LANE_WRAP_POS,
  LANE_DOWNTIMER, LANE_COUNTER, HEARTBEAT_ACCUM_LO, HEARTBEAT_ACCUM_HI, HEARTBEAT_ACCUM_OVERFLOW, ACCUM_REDUCE_TABLE,
} from "./names.js";

/**
 * tickHeartbeatCounters -- the per-interrupt timebase lane engine. ROM 0xcf24.
 *
 * Role in the machine: fired from the ~246Hz heartbeat interrupt (serviceHeartbeatInterrupt, 0xd704),
 * this drives Tempest's three parallel timebase "lanes". Each lane (x = 2,1,0) owns a wrapped position
 * cell (LANE_WRAP_POS loc_d/loc_e/loc_f), a down-timer (LANE_DOWNTIMER loc_10,x), and an event counter
 * (LANE_COUNTER loc_13,x). The lanes are stepped by control bits shifted out of the input port latch
 * (INPUT_PORT_LATCH loc_8) and paced by the interrupt subtimer (IRQ_SUBTIMER). Their motion is folded
 * into a running two-byte accumulator (HEARTBEAT_ACCUM_LO/HI loc_16/loc_17) plus an overflow tally
 * (HEARTBEAT_ACCUM_OVERFLOW loc_18); a DIP-selected reduction (ACCUM_REDUCE_TABLE loc_cfd9) periodically
 * drains that accumulator and nudges the phase counter (PHASE_COUNTER loc_6). Two final clamp passes bound
 * the LANE_COUNTER triple.
 *
 * Behavior: the original ROM is a dense web of conditional branches, so it is transcribed as an explicit
 * labelled state machine -- `phase` names the current 6502 block (b_cfNN = ROM address 0xcfNN) and `carry`
 * carries the running 6502 carry bit across blocks. The outer loop runs the three lanes (x = 2,1,0):
 * b_cf26 shifts control bits out of INPUT_PORT_LATCH (a per-lane bit count) to decide whether to advance
 * or wrap LANE_WRAP_POS,x masked to 0x1f; b_cf48/b_cf6f/b_cf7c handle the +0x20 wrap and the 0x1b/0x1f
 * rails; b_cf4a services the SOUND_STEP_GATE and clears a lane on gate expiry; b_cf63/b_cf87 run the
 * lane down-timer (reload 0x78 on zero); b_cf8b..b_cfa9 derive a small per-lane increment from DSW1
 * (DSW1_SNAPSHOT) and fold it into HEARTBEAT_ACCUM_LO/HI while bumping LANE_COUNTER,x; b_cfb7 advances to
 * the next lane. After the three lanes, b_cfbd subtracts a DSW-indexed amount from HEARTBEAT_ACCUM_LO and
 * advances the overflow tally; b_cfe1..b_d002 apply a further DSW-selected correction to
 * HEARTBEAT_ACCUM_HI and step PHASE_COUNTER; b_d004..b_d030 run two clamp passes (subtracting 0xef-with-
 * carry) over the LANE_COUNTER triple to keep the counters bounded, gated by IRQ_SUBTIMER bit 0.
 *
 * Cells touched (symbol -> zero-page/ROM address -> role):
 *   INPUT_PORT_LATCH        loc_8       raw input port, shifted for per-lane control bits
 *   IRQ_SUBTIMER            --          interrupt subtimer, paces the lanes and gates the clamp passes
 *   DSW1_SNAPSHOT           --          cached DIP switches, source of the per-lane increments and reductions
 *   SOUND_STEP_GATE         --          one-shot gate that resets a lane's position/timer as it drains
 *   LANE_WRAP_POS           loc_d,x     lane wrapped position (loc_d/loc_e/loc_f), masked to 0x1f
 *   LANE_DOWNTIMER          loc_10,x    lane down-timer, reloaded to 0x78 on expiry
 *   LANE_COUNTER            loc_13,x    lane event counter, bounded by the two clamp passes
 *   HEARTBEAT_ACCUM_LO/HI   loc_16/17   two-byte running accumulator the lanes fold into
 *   HEARTBEAT_ACCUM_OVERFLOW loc_18     overflow tally advanced as the accumulator drains
 *   ACCUM_REDUCE_TABLE      loc_cfd9    DSW-indexed reduction amounts subtracted from the accumulator
 *   PHASE_COUNTER           loc_6       phase counter nudged by the drain correction
 *
 * Block map (phase label -> ROM block -> job):
 *   b_cf26  0xcf26  shift control bits, load masked position, branch on the rails
 *   b_cf48  0xcf48  decrement position with borrow
 *   b_cf4a  0xcf4a  store position, prime the sound-step gate
 *   b_cf57  0xcf57  drain the sound-step gate, reset lane on drain
 *   b_cf63  0xcf63  run the lane down-timer, set carry on expiry
 *   b_cf6f  0xcf6f  wrap-up: add 0x20 to the position
 *   b_cf7c  0xcf7c  rail position at 0x1f, arm the down-timer
 *   b_cf87  0xcf87  reload the down-timer to 0x78
 *   b_cf8b  0xcf8b  derive the per-lane accumulator increment
 *   b_cfa1  0xcfa1  DSW1 bit-4 -> +1 increment
 *   b_cfa9  0xcfa9  fold increment into the accumulator, bump the lane counter
 *   b_cfb7  0xcfb7  advance to the next lane
 *   b_cfbd  0xcfbd  drain the accumulator by the DSW-indexed reduction
 *   b_cfe1  0xcfe1  DSW-selected correction to the high accumulator byte
 *   b_cffa/b_d000  step the phase counter
 *   b_d002  0xd002  commit the high accumulator byte
 *   b_d004  0xd004  gate the clamp passes on the subtimer
 *   b_d00d/b_d01a  first clamp pass over the lane counters
 *   b_d022/b_d02d  second clamp pass over the lane counters
 *   b_d030  0xd030  return
 *
 * Live-out: the three lane triples LANE_WRAP_POS / LANE_DOWNTIMER / LANE_COUNTER, the accumulator pair
 * HEARTBEAT_ACCUM_LO / HEARTBEAT_ACCUM_HI, the overflow tally HEARTBEAT_ACCUM_OVERFLOW, the SOUND_STEP_GATE,
 * and PHASE_COUNTER. Grounding: [seen].
 */
export function tickHeartbeatCounters(m) {
  const { mem8 } = m;
  let a = 0;
  let y = 0;
  let carry = 0;      // running 6502 carry bit threaded across the labelled blocks
  let x = 2;          // lane index, counts down 2 -> 1 -> 0
  let phase = "b_cf26";

  while (true) {
    switch (phase) {
      case "b_cf26": {
        // Shift the lane's control bits out of the input port latch (bit count varies by lane),
        // then load LANE_WRAP_POS,x masked to 0x1f and branch on the carry/position rails.
        a = mem8[INPUT_PORT_LATCH];
        if (x === 1) { carry = a & 1; a >>= 1; carry = a & 1; a >>= 1; }
        else if (x >= 1) { carry = a & 1; a >>= 1; }
        else { carry = a & 1; a >>= 1; carry = a & 1; a >>= 1; carry = a & 1; a >>= 1; }
        a = mem8[u8(LANE_WRAP_POS + x)] & 0x1f;
        if (carry) { phase = "b_cf6f"; break; }        // control bit set -> wrap-up path
        if (a === 0) { phase = "b_cf4a"; break; }       // position at 0 -> store as-is
        carry = a >= 0x1b ? 1 : 0;
        if (carry) { phase = "b_cf48"; break; }         // near the 0x1b rail -> decrement path
        y = a;
        { const t = mem8[IRQ_SUBTIMER] & 0x07; carry = t >= 0x07 ? 1 : 0; }  // pace on subtimer phase
        a = y;
        if (!carry) { phase = "b_cf4a"; break; }
        phase = "b_cf48"; break;
      }
      case "b_cf48": {
        // Decrement the position with borrow (6502 SBC #1).
        { const s = a - 1 - (1 - carry); carry = s >= 0 ? 1 : 0; a = s & 0xff; }
        phase = "b_cf4a"; break;
      }
      case "b_cf4a": {
        // Store the updated position; if input bit 3 is clear, prime the sound-step gate to 0xf0.
        mem8[u8(LANE_WRAP_POS + x)] = a;
        a = mem8[INPUT_PORT_LATCH] & 0x08;
        if (a !== 0) { phase = "b_cf57"; break; }
        a = 0xf0;
        mem8[SOUND_STEP_GATE] = a;
        phase = "b_cf57"; break;
      }
      case "b_cf57": {
        // Service the sound-step gate: while nonzero, tick it down and reset this lane's position/timer.
        a = mem8[SOUND_STEP_GATE];
        if (a === 0) { phase = "b_cf63"; break; }
        mem8[SOUND_STEP_GATE] = u8(mem8[SOUND_STEP_GATE] - 1);
        a = 0;
        mem8[u8(LANE_WRAP_POS + x)] = 0;
        mem8[u8(LANE_DOWNTIMER + x)] = 0;
        phase = "b_cf63"; break;
      }
      case "b_cf63": {
        // Run the lane down-timer: on a nonzero timer decrement it; reaching 0 sets carry (an event tick).
        carry = 0;
        a = mem8[u8(LANE_DOWNTIMER + x)];
        if (a === 0) { phase = "b_cf8b"; break; }
        { const v = u8(mem8[u8(LANE_DOWNTIMER + x)] - 1); mem8[u8(LANE_DOWNTIMER + x)] = v;
          if (v !== 0) { phase = "b_cf8b"; break; } }
        carry = 1;
        phase = "b_cf8b"; break;
      }
      case "b_cf6f": {
        // Wrap-up path: add 0x20 to the position; on carry-out fold toward the 0x1f rail.
        carry = a >= 0x1b ? 1 : 0;
        if (carry) { phase = "b_cf7c"; break; }
        a = mem8[u8(LANE_WRAP_POS + x)];
        { const s = a + 0x20; carry = s > 0xff ? 1 : 0; a = s & 0xff; }
        if (!carry) { phase = "b_cf4a"; break; }
        if (a === 0) { phase = "b_cf7c"; break; }
        carry = 0;
        phase = "b_cf7c"; break;
      }
      case "b_cf7c": {
        // Rail the position at 0x1f; if the down-timer is idle, arm it (reload path below).
        a = 0x1f;
        if (carry) { phase = "b_cf4a"; break; }
        mem8[u8(LANE_WRAP_POS + x)] = a;
        a = mem8[u8(LANE_DOWNTIMER + x)];
        if (a === 0) { phase = "b_cf87"; break; }
        carry = 1;
        phase = "b_cf87"; break;
      }
      case "b_cf87": {
        // Reload the lane down-timer to 0x78.
        a = 0x78;
        mem8[u8(LANE_DOWNTIMER + x)] = a;
        phase = "b_cf8b"; break;
      }
      case "b_cf8b": {
        // No event this lane -> skip the accumulator fold. Otherwise derive the per-lane increment.
        if (!carry) { phase = "b_cfb7"; break; }
        a = 0;
        if (x < 1) { phase = "b_cfa9"; break; }         // lane 0 folds a fixed 0
        if (x === 1) { phase = "b_cfa1"; break; }        // lane 1 uses the DSW1 bit-4 branch
        // lane 2: derive the increment from DSW1 bits 2-3
        a = mem8[DSW1_SNAPSHOT] & 0x0c;
        carry = a & 1; a >>= 1; carry = a & 1; a >>= 1;
        if (a === 0) { phase = "b_cfa9"; break; }
        { const s = a + 0x02 + carry; carry = s > 0xff ? 1 : 0; a = s & 0xff; }
        if (a !== 0) { phase = "b_cfa9"; break; }
        phase = "b_cfa1"; break;
      }
      case "b_cfa1": {
        // DSW1 bit 4 selects a +1 increment.
        a = mem8[DSW1_SNAPSHOT] & 0x10;
        if (a === 0) { phase = "b_cfa9"; break; }
        a = 0x01;
        phase = "b_cfa9"; break;
      }
      case "b_cfa9": {
        // Fold the increment into the two-byte accumulator (loc_16/loc_17) and bump this lane's counter.
        const sv = a;
        { const s = sv + mem8[HEARTBEAT_ACCUM_LO] + 1; carry = s > 0xff ? 1 : 0; mem8[HEARTBEAT_ACCUM_LO] = s; }
        { const s = sv + mem8[HEARTBEAT_ACCUM_HI] + 1; carry = s > 0xff ? 1 : 0; a = s & 0xff; mem8[HEARTBEAT_ACCUM_HI] = a; }
        mem8[u8(LANE_COUNTER + x)] = u8(mem8[u8(LANE_COUNTER + x)] + 1);
        phase = "b_cfb7"; break;
      }
      case "b_cfb7": {
        // Advance to the next lane, or fall out of the per-lane loop when x underflows.
        x = x - 1;
        if (x < 0) { phase = "b_cfbd"; break; }
        phase = "b_cf26"; break;
      }
      case "b_cfbd": {
        // Post-lane drain: subtract a DSW-indexed reduction (loc_cfd9,y) from HEARTBEAT_ACCUM_LO;
        // when it stays non-negative, advance the overflow tally loc_18 (twice, with a wrap guard).
        a = mem8[DSW1_SNAPSHOT];
        a >>= 1; a >>= 1; a >>= 1; a >>= 1; a >>= 1;
        y = a;
        a = mem8[HEARTBEAT_ACCUM_LO];
        { const s = a - mem8[u16(ACCUM_REDUCE_TABLE + y)]; carry = s >= 0 ? 1 : 0; a = s & 0xff; }
        if (a & 0x80) { phase = "b_cfe1"; break; }
        mem8[HEARTBEAT_ACCUM_LO] = a;
        mem8[HEARTBEAT_ACCUM_OVERFLOW] = u8(mem8[HEARTBEAT_ACCUM_OVERFLOW] + 1);
        if (y !== 0x03) { phase = "b_cfe1"; break; }
        mem8[HEARTBEAT_ACCUM_OVERFLOW] = u8(mem8[HEARTBEAT_ACCUM_OVERFLOW] + 1);
        if (mem8[HEARTBEAT_ACCUM_OVERFLOW] !== 0) { phase = "b_cfe1"; break; }
        // The 6502 fell through here into an embedded data table only if the state wrapped -- a corrupt
        // state that cannot occur on a valid image; surface it rather than execute table bytes as code.
        throw new Error("tickHeartbeatCounters: fell through into the embedded data table (state wrapped) -- unreachable in a valid state");
      }
      case "b_cfe1": {
        // DSW-selected correction to HEARTBEAT_ACCUM_HI: one's-complement a small value and add with carry,
        // routing the overflow tally through b_d004 when it goes negative.
        a = mem8[DSW1_SNAPSHOT] & 0x03;
        y = a;
        if (a === 0) { phase = "b_d002"; break; }
        carry = a & 1; a >>= 1;
        { const s = a + carry; carry = s > 0xff ? 1 : 0; a = s & 0xff; }
        a = a ^ 0xff;
        { const s = a + mem8[HEARTBEAT_ACCUM_HI] + 1; carry = s > 0xff ? 1 : 0; a = s & 0xff; }
        if (carry) { phase = "b_cffa"; break; }
        { const s = a + mem8[HEARTBEAT_ACCUM_OVERFLOW] + carry; carry = s > 0xff ? 1 : 0; a = s & 0xff; }
        if (a & 0x80) { phase = "b_d004"; break; }
        mem8[HEARTBEAT_ACCUM_OVERFLOW] = a;
        a = 0;
        phase = "b_cffa"; break;
      }
      case "b_cffa": {
        // Step the phase counter once when the DSW index is below 2 (b_d000 always adds the second step).
        carry = y >= 0x02 ? 1 : 0;
        if (carry) { phase = "b_d000"; break; }
        mem8[PHASE_COUNTER] = u8(mem8[PHASE_COUNTER] + 1);
        phase = "b_d000"; break;
      }
      case "b_d000": {
        // Unconditional phase-counter step, then commit HEARTBEAT_ACCUM_HI.
        mem8[PHASE_COUNTER] = u8(mem8[PHASE_COUNTER] + 1);
        phase = "b_d002"; break;
      }
      case "b_d002": {
        // Commit the accumulated high byte.
        mem8[HEARTBEAT_ACCUM_HI] = a;
        phase = "b_d004"; break;
      }
      case "b_d004": {
        // Clamp passes gate on IRQ_SUBTIMER bit 0: odd subtimer skips straight to the exit.
        a = mem8[IRQ_SUBTIMER];
        carry = a & 1; a >>= 1;
        if (carry) { phase = "b_d030"; break; }
        y = 0; x = 2;
        phase = "b_d00d"; break;
      }
      case "b_d00d": {
        // First clamp pass: any LANE_COUNTER,x >= 0x10 is reduced by 0x11 and tallied in y.
        a = mem8[u8(LANE_COUNTER + x)];
        if (a === 0) { phase = "b_d01a"; break; }
        carry = a >= 0x10 ? 1 : 0;
        if (!carry) { phase = "b_d01a"; break; }
        { const s = a + 0xef + carry; carry = s > 0xff ? 1 : 0; a = s & 0xff; }
        y = u8(y + 1);
        mem8[u8(LANE_COUNTER + x)] = a;
        phase = "b_d01a"; break;
      }
      case "b_d01a": {
        // Advance the first-pass lane index; if any lane was reduced (y != 0) skip the second pass.
        x = x - 1;
        if (x >= 0) { phase = "b_d00d"; break; }
        a = y;
        if (a !== 0) { phase = "b_d030"; break; }
        x = 2;
        phase = "b_d022"; break;
      }
      case "b_d022": {
        // Second clamp pass: reduce each nonzero LANE_COUNTER,x by 0x11, stopping at the first that
        // goes negative.
        a = mem8[u8(LANE_COUNTER + x)];
        if (a === 0) { phase = "b_d02d"; break; }
        carry = 0;
        { const s = a + 0xef + carry; carry = s > 0xff ? 1 : 0; a = s & 0xff; }
        mem8[u8(LANE_COUNTER + x)] = a;
        if (a & 0x80) { phase = "b_d030"; break; }
        phase = "b_d02d"; break;
      }
      case "b_d02d": {
        // Advance the second-pass lane index.
        x = x - 1;
        if (x >= 0) { phase = "b_d022"; break; }
        phase = "b_d030"; break;
      }
      case "b_d030":
        // Exit the interrupt engine.
        return;
    }
  }
}
