// SPDX-License-Identifier: GPL-3.0-only
/**
 * readControls — select the active joystick port and edge-debounce it into the cooked
 * control word the movement code reads.  ROM 0x0087.
 *
 * Runs once per vblank NMI, but only for a credited game: entry_0066 skips it entirely
 * while ATTRACT (0x6007) != 0, so it is never reached in plain attract. It picks one 8-bit
 * input port and folds it into the two bytes 0x6010/0x6011:
 *
 *   - PORT SELECT. An upright cabinet (DIP_UPRIGHT != 0) always reads IN0. A cocktail
 *     cabinet reads IN1 when the active-player select at 0x600E is non-zero (player 2's
 *     side of the shared panel), otherwise IN0.
 *   - DIRECTION is taken live from the low nibble every frame (bit0 R, bit1 L, bit2 U,
 *     bit3 D) — a held direction registers continuously.
 *   - JUMP is EDGE-detected: (~prevRaw) & raw keeps only bits that went 0->1 since last
 *     frame; the jump bit (0x10) of that is shifted up three places into bit 7, so
 *     P1_INPUT bit 7 is set for exactly one frame per press (a held jump does not repeat).
 *   - The cooked word (jump-edge bit 7 | direction nibble) goes to P1_INPUT, and the raw
 *     port to P1_INPUT_RAW (next frame's "previous reading"), as one 16-bit store.
 *   - Finally, raw bit 6 set means a service / soft-reset input; that arm is unexercised,
 *     so it throws NotImplemented, exactly as the oracle does — and only AFTER the store,
 *     so the two output bytes are already written when it throws.
 *
 * Reads only memory (no live-in registers), so it is a pure function of memory state:
 * DIP_UPRIGHT, 0x600E, the selected port, and P1_INPUT_RAW.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0087.test.js.
 * GATE:     exhaustive — the cooked-word math is a pure function of (raw, prevRaw), swept
 *           over all 256x256 pairs vs the oracle; a separate sweep pins the IN0/IN1 choice
 *           over (DIP_UPRIGHT, 0x600E); plus real captured in-game dispatches. Reached only
 *           for a credited game (ATTRACT==0); captured via the NMI's m.call(0x0141) DMA
 *           blit, the last dispatch before the direct readControls call.
 * LIVE-OUT: memory-only — P1_INPUT (0x6010) and P1_INPUT_RAW (0x6011). No live regs/flags:
 *           the NMI successor (FRAME decrement at ROM 0x00B5) reloads A and reads neither
 *           the register file nor the SP this routine leaves (it uses only m.tick — no
 *           push/step — so it moves neither PC nor SP).
 * NAMES:    DIP_UPRIGHT (0x6026), P1_INPUT (0x6010), P1_INPUT_RAW (0x6011). Hex-kept:
 *           0x600E (cocktail active-player select — unconfirmed in ram.js) and the IN0/IN1
 *           port addresses 0x7C00/0x7C80 (board I/O, not work RAM).
 */

import { DIP_UPRIGHT, P1_INPUT, P1_INPUT_RAW } from "./ram.js";
import { NotImplemented } from "../../../boards/dkong/io.js";

const IN0 = 0x7c00; // player-1 joystick port
const IN1 = 0x7c80; // player-2 joystick port (cocktail)
const COCKTAIL_PLAYER_SELECT = 0x600e; // non-zero => read IN1 on a cocktail cabinet

export function readControls(m) {
  const { mem } = m;

  // Port select: upright -> IN0; cocktail -> IN1 if the player-2 side is active, else IN0.
  let raw;
  if (mem.read8(DIP_UPRIGHT) !== 0) {
    raw = mem.read8(IN0);
  } else if (mem.read8(COCKTAIL_PLAYER_SELECT) !== 0) {
    raw = mem.read8(IN1);
  } else {
    raw = mem.read8(IN0);
  }

  const direction = raw & 0x0f;
  const prevRaw = mem.read8(P1_INPUT_RAW);
  // Edge-detect the jump bit: keep bit 4 only where it went 0->1 since last frame, then
  // lift it three places to bit 7. Isolating bit 4 first (& 0x10) makes the shift exact —
  // the value can only be 0 or 0x80 and never carries past bit 7.
  const jumpEdge = (((~prevRaw) & raw) & 0x10) << 3; // 0x00 or 0x80
  const cooked = jumpEdge | direction; // jump-edge bit 7 merged with the direction nibble

  mem.write8(P1_INPUT, cooked); // 0x6010 = low byte of the one 16-bit control-word store
  mem.write8(P1_INPUT_RAW, raw); // 0x6011 = high byte

  // Raw bit 6 set is a service / soft-reset input (unexercised); preserve the oracle's
  // throw, which happens only after the store above.
  if (raw & 0x40) {
    throw new NotImplemented(
      "input bit 6 set: jp 0x0000 at ROM 0x00B2 -- soft reset via input, " +
        "path not yet exercised",
    );
  }
}
