// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_00, loc_40, loc_43, loc_70, loc_86,
  loc_b2, SFX_TIMER_CH2, SFX_TIMER_CH3, SFX_TIMER_CH4, SFX_TIMER_CH2_PRIORITY, SFX_TIMER_CH1_PRIORITY, loc_b8,
  loc_ef, loc_f0, loc_f4,
  AUDF1, AUDC1, AUDF2, AUDC2, AUDF3, AUDC3, AUDF4, AUDC4,
  loc_3148, loc_315b, loc_316e, loc_3175, loc_317c, loc_3187, loc_319b, loc_31af, loc_31c0,
} from "./names.js";

/**
 * updateSoundChannels — the per-frame POKEY voice updater: the whole audio output stage in one pass.
 *
 * Role in the machine: once per frame it refreshes the four POKEY voices. Each voice is fronted by a
 * sound-effect countdown timer in zero page ($b2..$b8), and the shape is always the same — while the
 * timer is nonzero, decrement it, use its value to index a pair of ROM byte tables, and copy one byte
 * into that voice's frequency register (AUDFn) and one into its control/volume register (AUDCn); when
 * the timer runs down to zero, leave the control register at zero so the voice falls silent. The timer
 * is thus both the "how far into this effect are we" cursor and the on/off gate, and the ROM tables are
 * the recorded envelope played back one step per frame.
 *
 * Structure: a global mute check first (master flag $86), then the four voices in turn — some gated on
 * the frame counter $00. The AUDF2 voice is the busiest: a small priority ladder chooses between a
 * pitched pre-empt voice, a collision/skitter router (the $b8 sweep, an arithmetic noise value, or the
 * $b3 voice), split here into `audf2Section`. The AUDF1 voice is shared between the $b2 and priority
 * $b7 timers, split into `audf1Tail`.
 *
 * Grounding: [code] for the state cells and ROM tables; POKEY registers and the SFX timers are [seen].
 */
export function updateSoundChannels(m) {
  // Global mute check. If the master audio flag $86 is negative, zero all four control/volume registers
  // and return. Clearing the CONTROL registers (not the frequency ones) is what actually silences the
  // chip — a POKEY voice at volume zero makes no sound regardless of pitch — so this is the audio kill
  // switch for the whole chip at once.
  if (m.mem8[loc_86] & 0x80) {
    m.mem8[AUDC1] = 0;
    m.mem8[AUDC2] = 0;
    m.mem8[AUDC3] = 0;
    m.mem8[AUDC4] = 0;
    return;
  }
  // Latch the frame counter once; several voices gate their rate off it.
  const frame = m.mem8[loc_00];

  // $b5 voice (AUDF4/AUDC4) — the highest voice, updated on ODD frames only so it advances at half
  // rate. It is also the only voice that WRAPS instead of stopping: when its decrement reaches zero the
  // timer reloads to 0x14, making it a free-running loop. Frequency comes from the table at 0x3187 and
  // volume from 0x319b. An idle timer leaves AUDC4 = 0 (silent); on even frames it holds its last write.
  if (frame & 0x01) {
    const y = m.mem8[SFX_TIMER_CH4];
    let audc4 = 0;
    if (y !== 0) {
      let t = y - 1;
      if (t === 0) t = 0x14;
      m.mem8[SFX_TIMER_CH4] = t;
      m.mem8[AUDF4] = m.mem8[loc_3187 + y];
      audc4 = m.mem8[loc_319b + y];
    }
    m.mem8[AUDC4] = audc4;
  }

  // $b4 voice (AUDF3/AUDC3) — runs every frame. It reads frequency from the table at 0x317c but, unlike
  // the others, does NOT table-lookup its volume: while active AUDC3 is pinned to the constant 0x64, so
  // only its pitch is animated. Idle timer leaves AUDC3 = 0.
  {
    const y = m.mem8[SFX_TIMER_CH3];
    let audc3 = 0;
    if (y !== 0) {
      m.mem8[SFX_TIMER_CH3] = y - 1;
      m.mem8[AUDF3] = m.mem8[loc_317c + y];
      audc3 = 0x64;
    }
    m.mem8[AUDC3] = audc3;
  }

  // The AUDF2 selection (priority ladder + collision router), then the AUDF1 tail. The AUDF1 tail always
  // runs, even when the AUDF2 section skips itself.
  audf2Section(m, frame);
  audf1Tail(m, frame);
}

/**
 * audf2Section — the AUDF2/AUDC2 selection for the busiest voice.
 *
 * First the pitched pre-empt timer $b6: if armed it claims the voice, but is gated on frame & 7 (every
 * eighth frame). On its frame it decrements and, while nonzero, plays the pitched value from 0x31af at
 * volume 0xa4; on the frame it hits zero it releases the claim and falls through. If $b6 was already idle
 * the code goes straight to the collision decision — a router of three game-state comparisons choosing
 * the $b3 voice, the $b8 sweep, or an arithmetic noise value. Returns after writing AUDF2/AUDC2, or
 * without touching either when the $b6 gate skips the section; the caller always runs the AUDF1 tail.
 */
function audf2Section(m, frame) {
  const y0 = m.mem8[SFX_TIMER_CH2_PRIORITY];
  if (y0 !== 0) {
    if ((frame & 0x07) !== 0) return;          // not our frame — skip AUDF2 entirely
    const y = y0 - 1;
    m.mem8[SFX_TIMER_CH2_PRIORITY] = y;
    if (y !== 0) {
      m.mem8[AUDF2] = m.mem8[loc_31af + y]; // b6 pitched value
      m.mem8[AUDC2] = 0xa4;
      return;
    }
  }

  // Collision decision: route to the $b3 voice, the $b8 sweep, or the noise value.
  // Three game-state comparisons, each a running cell XORed/masked against a companion: $70 ^ $f0,
  // $43 & 0xaf, and $40 ^ $ef. Any of the first three conditions routes to the $b3 timer-driven voice.
  if ((m.mem8[loc_70] ^ m.mem8[loc_f0]) >= 0xf8) { b3Voice(m); return; }
  if ((m.mem8[loc_43] & 0xaf) !== 0) { b3Voice(m); return; }
  const d = m.mem8[loc_40] ^ m.mem8[loc_ef];
  if (d >= 0x34) { b3Voice(m); return; }
  if (d >= 0x20) {
    // Mid band (0x20..0x34): the free-running $b8 sweep. $b8 counts down and, on hitting zero, reloads
    // to 0x14 (the 6502 `dey` wraps at 0), and its current value indexes the table at 0x31c0 into AUDF2
    // at volume 0xa4. $b8 is this self-reloading cursor, not a static base.
    let y = (m.mem8[loc_b8] - 1) & 0xff;
    if (y === 0) y = 0x14;
    m.mem8[loc_b8] = y;
    m.mem8[AUDF2] = m.mem8[loc_31c0 + y];
    m.mem8[AUDC2] = 0xa4;
    return;
  }
  // Low band (< 0x20): no table at all — build a noise pitch arithmetically from $70 ^ $f4 (shift right
  // one, complement, force the top bit set). Forcing bit 7 keeps the value in the upper half of the
  // frequency range so the noise stays in a fixed register regardless of game state. Volume 0xa4.
  let n = m.mem8[loc_70] ^ m.mem8[loc_f4];
  n = (n >> 1) ^ 0xff;
  n = n | 0x80;
  m.mem8[AUDF2] = n;
  m.mem8[AUDC2] = 0xa4;
}

/**
 * b3Voice — the ordinary timer-driven channel-2 voice ($b3), the target all three collision comparisons
 * route to. Frequency from 0x316e, volume from 0x3175; goes silent when the timer expires. Note that if
 * a comparison routes here but $b3 is idle the net result is silence — the router decides THAT a collision
 * sound should play, and $b3 decides WHETHER one currently is. Idle timer leaves AUDC2 = 0.
 */
function b3Voice(m) {
  const y = m.mem8[SFX_TIMER_CH2];
  let audc2 = y;
  if (y !== 0) {
    m.mem8[SFX_TIMER_CH2] = y - 1;
    m.mem8[AUDF2] = m.mem8[loc_316e + y];
    audc2 = m.mem8[loc_3175 + y];
  }
  m.mem8[AUDC2] = audc2;
}

/**
 * audf1Tail — voice one (AUDF1/AUDC1), shared between two timers by priority. The priority timer $b7
 * wins when armed; otherwise the plain $b2 timer drives the voice. Both read the SAME ROM tables
 * (frequency 0x3148, volume 0x315b) — they play the same recorded effect, so $b7 is just a
 * higher-priority trigger for it. The $b2 path runs every frame; the $b7 path is gated on frame & 3
 * (every fourth frame) and nudges its looked-up volume up by 2 when nonzero, so the priority version
 * plays slightly louder. Both go quiet as their timer reaches zero.
 */
function audf1Tail(m, frame) {
  const y7 = m.mem8[SFX_TIMER_CH1_PRIORITY];
  if (y7 === 0) {
    // $b2 voice (AUDF1/AUDC1), every frame. Idle timer leaves AUDC1 = 0.
    const y = m.mem8[loc_b2];
    let audc1 = y;
    if (y !== 0) {
      m.mem8[loc_b2] = y - 1;
      m.mem8[AUDF1] = m.mem8[loc_3148 + y];
      audc1 = m.mem8[loc_315b + y];
    }
    m.mem8[AUDC1] = audc1;
    return;
  }
  // $b7 priority voice (AUDF1/AUDC1), gated on frame & 0x03 (every fourth frame).
  if ((frame & 0x03) !== 0) return;
  m.mem8[SFX_TIMER_CH1_PRIORITY] = y7 - 1;
  const y = y7 - 1;
  if (y === 0) return;
  m.mem8[AUDF1] = m.mem8[loc_3148 + y];
  let audc1 = m.mem8[loc_315b + y];
  if (audc1 !== 0) audc1 = (audc1 + 0x02) & 0xff; // priority version plays a touch louder
  m.mem8[AUDC1] = audc1;
}
