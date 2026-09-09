// SPDX-License-Identifier: GPL-3.0-only
import { loc_a1, SFX_TIMER_CH4, loc_41, loc_f2, POKEY_RANDOM } from "./names.js";

/**
 * tickColumnCountdown — one of the game's small periodic clocks.
 *
 * Role in the machine: a self-reloading countdown living in the zero-page cell $a1.
 * Most ticks it just decrements that cell by one; the interesting work only happens on
 * the frame the countdown wraps through zero. When it wraps it reloads a fresh, randomly
 * chosen interval and re-arms two companion cells that other subsystems consume — so this
 * routine is what re-schedules a recurring event and jitters its period so the event does
 * not land on the same beat every time.
 *
 * Cells: $a1 is this routine's own countdown; $b5 (SFX_TIMER_CH4) is a companion timer the
 * sound updater plays back; $41 is the folded key the spawn cadence and timer bank pass
 * around; $f2 is an orientation/flip byte. The random draw comes from the POKEY RANDOM
 * hardware register at $100a (a read-only polynomial RNG on the board).
 *
 * Grounding: [code] — read from decompiled behaviour. Live-out: $a1, and on a wrap also
 * $b5 and $41.
 */
export function tickColumnCountdown(m) {
  const { mem8 } = m;

  // Step the countdown down by one, masking back into a byte so 0x00 - 1 wraps to 0xff
  // exactly as the 6502 `dec` would. While the counter has not yet reached zero the
  // interval is still running, so there is nothing to reload — leave and wait for the
  // next tick.
  const next = (mem8[loc_a1] - 1) & 0xff;
  mem8[loc_a1] = next;
  if (next !== 0) return;

  // The countdown expired this tick. Reload $a1 with a fresh interval drawn from the POKEY
  // hardware RNG: masking the random byte to 0x2f and OR-ing in 0x0f yields either 0x0f or
  // 0x2f (the low nibble is forced to 0xf, only bit 5 varies), so the next period is one of
  // two lengths chosen at random — that is the jitter that keeps the event off a fixed beat.
  mem8[loc_a1] = (m.mem8[POKEY_RANDOM] & 0x2f) | 0x0f;

  // Re-arm the two companion cells the expiry is meant to trigger: prime the channel-4 SFX
  // timer to 0x14 so the sound updater begins playing that voice's envelope, and refresh the
  // folded key $41 as 0x14 XORed with the orientation byte $f2 so the value mirrors correctly
  // for a flipped cabinet.
  mem8[SFX_TIMER_CH4] = 0x14;
  mem8[loc_41] = 0x14 ^ mem8[loc_f2];
}
