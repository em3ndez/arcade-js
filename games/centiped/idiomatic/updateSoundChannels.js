// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_00, loc_40, loc_43, loc_70, loc_86,
  loc_b2, loc_b3, loc_b4, loc_b5, loc_b6, loc_b7, loc_b8,
  loc_ef, loc_f0, loc_f4,
  loc_1000, loc_1001, loc_1002, loc_1003, loc_1004, loc_1005, loc_1006, loc_1007,
  loc_3148, loc_315b, loc_316e, loc_3175, loc_317c, loc_3187, loc_319b, loc_31af, loc_31c0,
} from "./names.js";

/**
 * updateSoundChannels — the per-frame POKEY voice updater. Ages each active sound-effect
 * countdown timer ($b2-$b8) and, for each live one, decrements it and copies the next byte of
 * that effect's waveform table into the matching POKEY frequency/control register.
 *
 *   If the master audio flag $86 is negative, the four control registers are zeroed and it
 *   returns (all voices silenced). Otherwise the voices update in turn, some gated on the frame
 *   counter $00. A middle block reads game state ($70^$f0, $43&$af, $40^$ef) to choose between a
 *   pitched collision/skitter voice (the $b8 sweep down 0x14..1) and a noise value from $70^$f4.
 *   Split into per-voice helpers; the $40/$70 gate falls into the $b8 sweep as an if/else. [code]
 */
export function updateSoundChannels(m) {
  // Master audio flag: if negative, silence every POKEY control register and return.
  if (m.mem8[loc_86] & 0x80) {
    m.mem8[loc_1001] = 0;
    m.mem8[loc_1003] = 0;
    m.mem8[loc_1005] = 0;
    m.mem8[loc_1007] = 0;
    return;
  }
  const frame = m.mem8[loc_00];

  // $b5 voice (AUDF4/AUDC4) — odd frames only. Idle timer leaves AUDC4 = 0.
  if (frame & 0x01) {
    const y = m.mem8[loc_b5];
    let audc4 = 0;
    if (y !== 0) {
      let t = y - 1;
      if (t === 0) t = 0x14;
      m.mem8[loc_b5] = t;
      m.mem8[loc_1006] = m.mem8[loc_3187 + y];
      audc4 = m.mem8[loc_319b + y];
    }
    m.mem8[loc_1007] = audc4;
  }

  // $b4 voice (AUDF3/AUDC3). Idle timer leaves AUDC3 = 0.
  {
    const y = m.mem8[loc_b4];
    let audc3 = 0;
    if (y !== 0) {
      m.mem8[loc_b4] = y - 1;
      m.mem8[loc_1004] = m.mem8[loc_317c + y];
      audc3 = 0x64;
    }
    m.mem8[loc_1005] = audc3;
  }

  audf2Section(m, frame);
  audf1Tail(m, frame);
}

/**
 * The AUDF2/AUDC2 selection: the $b6 pitched voice, else the collision decision (the $b8 sweep, a
 * noise value, or the $b3 voice). Returns after writing AUDF2/AUDC2 — or without touching either
 * when the $b6 gate skips the whole section (falling straight through to the AUDF1 tail). The
 * caller always runs the AUDF1 tail afterward.
 */
function audf2Section(m, frame) {
  const y0 = m.mem8[loc_b6];
  if (y0 !== 0) {
    if ((frame & 0x07) !== 0) return;          // not our frame — skip AUDF2 entirely
    const y = y0 - 1;
    m.mem8[loc_b6] = y;
    if (y !== 0) {
      m.mem8[loc_1002] = m.mem8[loc_31af + y]; // b6 pitched value
      m.mem8[loc_1003] = 0xa4;
      return;
    }
  }

  // Collision decision: route to the $b3 voice, the $b8 sweep, or the noise value.
  if ((m.mem8[loc_70] ^ m.mem8[loc_f0]) >= 0xf8) { b3Voice(m); return; }
  if ((m.mem8[loc_43] & 0xaf) !== 0) { b3Voice(m); return; }
  const d = m.mem8[loc_40] ^ m.mem8[loc_ef];
  if (d >= 0x34) { b3Voice(m); return; }
  if (d >= 0x20) {
    // The free-running $b8 sweep down 0x14..1 (dey wraps at 0, reloading to 0x14).
    let y = (m.mem8[loc_b8] - 1) & 0xff;
    if (y === 0) y = 0x14;
    m.mem8[loc_b8] = y;
    m.mem8[loc_1002] = m.mem8[loc_31c0 + y];
    m.mem8[loc_1003] = 0xa4;
    return;
  }
  // Noise value derived from $70 ^ $f4.
  let n = m.mem8[loc_70] ^ m.mem8[loc_f4];
  n = (n >> 1) ^ 0xff;
  n = n | 0x80;
  m.mem8[loc_1002] = n;
  m.mem8[loc_1003] = 0xa4;
}

/** The $b3 voice (AUDF2/AUDC2 from its waveform tables). Idle timer leaves AUDC2 = 0. */
function b3Voice(m) {
  const y = m.mem8[loc_b3];
  let audc2 = y;
  if (y !== 0) {
    m.mem8[loc_b3] = y - 1;
    m.mem8[loc_1002] = m.mem8[loc_316e + y];
    audc2 = m.mem8[loc_3175 + y];
  }
  m.mem8[loc_1003] = audc2;
}

/**
 * The AUDF1 tail: the $b7-gated AUDF1 voice. When $b7 is idle, the $b2 voice drives AUDF1/AUDC1;
 * otherwise the $b7 voice does (gated on $00 & 0x03, its AUDC1 nudged +2 when nonzero).
 */
function audf1Tail(m, frame) {
  const y7 = m.mem8[loc_b7];
  if (y7 === 0) {
    // $b2 voice (AUDF1/AUDC1). Idle timer leaves AUDC1 = 0.
    const y = m.mem8[loc_b2];
    let audc1 = y;
    if (y !== 0) {
      m.mem8[loc_b2] = y - 1;
      m.mem8[loc_1000] = m.mem8[loc_3148 + y];
      audc1 = m.mem8[loc_315b + y];
    }
    m.mem8[loc_1001] = audc1;
    return;
  }
  // $b7 voice (AUDF1/AUDC1), gated on frame & 0x03.
  if ((frame & 0x03) !== 0) return;
  m.mem8[loc_b7] = y7 - 1;
  const y = y7 - 1;
  if (y === 0) return;
  m.mem8[loc_1000] = m.mem8[loc_3148 + y];
  let audc1 = m.mem8[loc_315b + y];
  if (audc1 !== 0) audc1 = (audc1 + 0x02) & 0xff;
  m.mem8[loc_1001] = audc1;
}
