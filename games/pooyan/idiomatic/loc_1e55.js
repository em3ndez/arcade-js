// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  BOARD_CLEAR_FLAG,
  TAMPER_OBJECT_FREEZE_FLAG,
  GAME_ACTIVE_FLAG,
  LEAD_ACTOR_STATE,
  WAVE_TEARDOWN_STATE,
  SECONDARY_TEARDOWN_FLAG,
  FLIP_SCREEN_FLAG,
  IN1_PORT,
  IN2_PORT,
  PLAYER_AIM_FLAGS,
  INPUT_ROTATE_LATCH,
} from "./names.js";
/**
 * loc_1e55 — per-frame joystick sampler for the player-actor state byte.  [seen]
 *
 * ROM 0x1e55–0x1ea6. Runs once per frame as part of the player update. Its job is to fold the
 * live joystick reading into PLAYER_AIM_FLAGS (0x8a87), the player-actor's state byte, whose
 * low bits carry the raw direction input and whose bit 4 the aim logic downstream reads. The
 * hardware input ports are ACTIVE-LOW — an idle stick reads all-ones and a pressed direction
 * pulls its bit to zero — so the routine stores the ONE'S COMPLEMENT of the port, turning it
 * into a conventional active-high flag byte.
 *
 * A cluster of freeze/teardown flags gates the sampler. Whenever the board is being cleared,
 * the objects are frozen, the lead actor is mid-animation, or a wave is tearing down, the
 * player must not be allowed to steer, so the state byte is forced to 0 and the routine
 * leaves. It also does nothing at all while the game is not active (attract with no play).
 *
 * The last stage is an anti-jitter / edge filter on the aim bit. Each frame the complemented
 * joystick's bit 4 is rotated into INPUT_ROTATE_LATCH (0x8f03), a rolling shift register of
 * recent bit-4 samples. Only when the latch's low three bits equal exactly 1 — i.e. the bit
 * was set this frame but clear in the two before it, a fresh rising edge — is bit 4 left
 * standing in the state byte; every other pattern clears bit 4, so a held or noisy bit 4
 * does not register as a repeated aim event.
 *
 * LIVE-OUT: memory only — PLAYER_AIM_FLAGS (0x8a87) and INPUT_ROTATE_LATCH (0x8f03). This is
 * a leaf; no register value is consumed by a caller.
 */
const AIM_BIT4 = 0x10;

export function loc_1e55(m) {
  const { mem8 } = m;

  // Board-clear / object-freeze gate: while the level-intro or board-clear path owns the
  // screen (BOARD_CLEAR_FLAG 0x89e5) or object updates are frozen (TAMPER_OBJECT_FREEZE_FLAG
  // 0x89fb), the player cannot steer — blank the state byte and leave.
  if (mem8[BOARD_CLEAR_FLAG] !== 0 || mem8[TAMPER_OBJECT_FREEZE_FLAG] !== 0) {
    mem8[PLAYER_AIM_FLAGS] = 0;
    return;
  }

  // Not in play at all (GAME_ACTIVE_FLAG 0x8806 == 0, attract with no game running): leave the
  // state byte untouched and do nothing this frame.
  if (mem8[GAME_ACTIVE_FLAG] === 0) return;

  // Lead-actor busy: while LEAD_ACTOR_STATE (0x8a82) is nonzero the player-actor is running a
  // scripted animation (spawn/death), so input is suppressed and the state byte cleared.
  if (mem8[LEAD_ACTOR_STATE] !== 0) {
    mem8[PLAYER_AIM_FLAGS] = 0;
    return;
  }

  // Wave-teardown gate: either the primary wave-teardown state (WAVE_TEARDOWN_STATE 0x8f24) or
  // the secondary teardown flag (SECONDARY_TEARDOWN_FLAG 0x8f57) being set means an attack wave
  // is being dismantled — freeze steering and clear the state byte.
  if ((mem8[WAVE_TEARDOWN_STATE] | mem8[SECONDARY_TEARDOWN_FLAG]) !== 0) {
    mem8[PLAYER_AIM_FLAGS] = 0;
    return;
  }

  // Select the physical control port by cabinet orientation. FLIP_SCREEN_FLAG (0x881f) is
  // nonzero for a normal upright screen → read player 1's port (IN1_PORT 0xa0a0); zero means
  // the image is mirrored for the cocktail's second player → read IN2_PORT (0xa0c0). Both
  // ports are active-low, so complement the reading to get an active-high aim byte and store it
  // as the player-actor state byte (PLAYER_AIM_FLAGS 0x8a87).
  const input = mem8[FLIP_SCREEN_FLAG] !== 0 ? mem8[IN1_PORT] : mem8[IN2_PORT];
  const aim = u8(~input);
  mem8[PLAYER_AIM_FLAGS] = aim;

  // Shift the freshest bit-4 sample into the rolling edge latch. On the hardware four left-
  // rotations of A carry the complemented joystick's bit 4 out into the carry flag, and a
  // rotate-left of INPUT_ROTATE_LATCH (0x8f03) shifts that carry into the latch's bit 0 —
  // producing a 3-deep history of recent bit-4 states in the latch's low bits.
  const topBit = (aim >> 4) & 1;
  const latch = u8((mem8[INPUT_ROTATE_LATCH] << 1) | topBit);
  mem8[INPUT_ROTATE_LATCH] = latch;

  // Edge filter: latch low-3 == 1 is the single rising-edge pattern (set now, clear the two
  // prior frames) — leave bit 4 standing in the state byte. Any other pattern (held, absent,
  // or bouncing) clears AIM_BIT4 (0x10) so the aim bit fires only on a clean fresh press.
  if ((latch & 0x07) === 1) return;
  mem8[PLAYER_AIM_FLAGS] = aim & ~AIM_BIT4;
}
