// SPDX-License-Identifier: GPL-3.0-only
/** advanceAttractTowardGameStart — guarded tail of the phase-3 image step: bail while play is active, else reset the
 * sub-step/phase on a pending flag, or on free-play + two input bits hide the sprites and start a game.
 * Every early bail leaves the byte it tested in the accumulator and the flags that AND-with-itself
 * set; the reset bail leaves the phase byte it stored and the flags a cleared accumulator set.
 * LIVE-OUT: memory + the accumulator and flags each bail leaves behind. */
import { F_H, F_PV, F_S, F_Z, F_F3, F_F5 } from "../../../core/cpu/z80.js";
import { hideAllSprites } from "./hideAllSprites.js";
import { startGameOnFreePlay } from "./startGameOnFreePlay.js";
import { CREDIT_COUNT, FREE_PLAY, IN0_MIRROR, PLAY_ACTIVE, SEQUENCE_PHASE, SEQUENCE_SUBSTEP, SEQUENCE_PHASE_ON_CREDIT } from "./names.js";

const parity8 = (v) => {
  let bits = 0;
  for (let x = v; x; x >>= 1) bits += x & 1;
  return bits & 1 ? 0 : F_PV;
};
const sz8 = (v) => (v & 0x80 ? F_S : 0) | (v === 0 ? F_Z : 0) | (v & (F_F3 | F_F5));
// Flags an AND of a byte with itself leaves: sign/zero/undocumented from the byte, half-carry always,
// parity, no subtract, no carry.
const andFlags = (v) => sz8(v) | F_H | parity8(v);

export function advanceAttractTowardGameStart(m) {
  const { mem8 } = m;

  const active = mem8[PLAY_ACTIVE];
  if (active !== 0) return (m.regs.a = active, m.regs.f = andFlags(active));

  if (mem8[CREDIT_COUNT] !== 0) {
    const phase = mem8[SEQUENCE_PHASE_ON_CREDIT];
    mem8[SEQUENCE_SUBSTEP] = 0;
    mem8[SEQUENCE_PHASE] = phase;
    // the accumulator is cleared before the stores and reloaded with the phase byte after them;
    // the flags are the ones that clearing left.
    return (m.regs.a = phase, m.regs.f = F_Z | F_PV);
  }

  const freePlay = mem8[FREE_PLAY];
  if (freePlay === 0) return (m.regs.a = freePlay, m.regs.f = andFlags(freePlay));

  const inputBits = mem8[IN0_MIRROR] & 0x18;
  if (inputBits === 0) return (m.regs.a = inputBits, m.regs.f = andFlags(inputBits));

  // hide the sprites, then start the game; the start is the tail, so its return is this arm's.
  hideAllSprites(m);
  return startGameOnFreePlay(m);
}
