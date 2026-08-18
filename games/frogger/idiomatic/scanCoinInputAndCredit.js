// SPDX-License-Identifier: GPL-3.0-only
/**
 * scanCoinInputAndCredit  —  ROM 0x2cf0  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The coin/credit front end of the cabinet — the routine that watches the coin door, debounces a
 *   dropped coin, awards the credit, and (if no game is running) throws the machine into the
 *   player-select screen so the player can press START. It is the whole "insert coin → CREDIT 01" path.
 *
 * WHERE IT SITS
 *   Called first thing, once per displayed frame, by the vblank interrupt handler serviceVblankNmi
 *   (ROM 0x0066) — see mechanisms.md "The vblank frame clock". The NMI is the machine's frame clock and
 *   its only accumulator, so the coin scan runs on that steady tick: exactly one look at the coin door
 *   per frame. On the overwhelming majority of frames no coin is present and the routine falls straight
 *   through one of its two early returns without touching memory.
 *
 * HOW A COIN FLOWS THROUGH IT (a two-frame debounce)
 *   IN0_PORT (0xe000) is active-low, so the routine inverts it and masks the three coin/service lines
 *   (COIN_SERVICE_MASK 0xc4). The coin is latched on the way IN and credited on the way OUT:
 *     Frame the coin is pressed:  the latch COIN_INPUT_LATCH (0x83e2) is idle (0), so we record which
 *                                 line is held into the latch and return — the machine is now "armed".
 *     Frames the coin stays held: the latch is non-zero but a masked bit is still high, so we return.
 *     Frame the coin releases:    the latch is non-zero and every masked bit is low again — the release
 *                                 edge — so we credit exactly once. Debouncing on release is what stops
 *                                 a single physical coin (held across many frames) from crediting twice.
 *
 * LIVE-OUT
 *   Memory only. It writes the coin latch/toggle/counter/timer cells, the packed-BCD credit total, and —
 *   on the start path — the game-mode/draw-state cells plus the cleared fly work block and the credit
 *   line VRAM. It returns nothing and leaves no register the caller reads.
 */
import {
  IN0_PORT, COIN_INPUT_LATCH, COINAGE_WORD, COIN_PAIR_TOGGLE,
  COIN_COUNTER_0, COIN_COUNTER_1, COIN_PULSE_TIMER_0, COIN_PULSE_TIMER_1,
  CREDIT_BCD, PLAY_FLAG, GAME_MODE, POINT_TABLE_DRAW_STATE, FLY_SPRITE_X,
} from "./names.js";
import { issueSoundCommand } from "./issueSoundCommand.js";
import { bcdAddByte } from "../../../core/bcd.js";
import { blitPlayerSelectPrompt } from "./blitPlayerSelectPrompt.js";
import { renderCreditLine } from "./renderCreditLine.js";

// The three coin/service input lines of IN0, active-low so tested against the INVERTED port. The mask
// isolates: coin slot 1 (bit 0x80), coin slot 2 (bit 0x40), and the free-play service switch (bit 0x04).
const COIN_SERVICE_MASK = 0xc4;
// Latch-bit meanings once a press has been recorded into COIN_INPUT_LATCH (0x83e2):
const SLOT2_BIT = 0x40;         //   this bit set → the coin went into slot 2 (uses coin counter 1)
const SKIP_COUNTER_BIT = 0x04;  //   service switch → credit the coin but DON'T pulse the mechanical counter
// Value seeded into a coin-counter pulse timer (COIN_PULSE_TIMER_0/1, 0x837e/0x837f). The NMI decrements
// the timer each frame and drops the physical coin-counter latch back to 0 when it drains — so the coin
// counter's solenoid is energised for 4 frames, one visible "tick" of the mechanical counter.
const COIN_PULSE = 0x04;
const CREDIT_CLAMP = 0x99;      // packed-BCD credit ceiling: CREDIT_BCD (0x83e1) never exceeds 99
const SELECT_MODE = 5;          // GAME_MODE (0x83d6) value for the player-select screen
const WORK_BLOCK_LEN = 0x20;    // bytes of the fly/object work block cleared when the select flow starts

export function scanCoinInputAndCredit(m) {
  const { mem8, mem16 } = m;

  // ── Read the coin door ────────────────────────────────────────────────────────────────
  // IN0_PORT (0xe000) is active-low: a PRESSED line reads 0. Invert so a pressed line reads 1, which
  // makes the coin/service bits directly testable with COIN_SERVICE_MASK (0xc4).
  const notIn0 = (~mem8[IN0_PORT]) & 0xff;

  // ── Arm pass: latch idle → record the current press and leave ─────────────────────────
  // While COIN_INPUT_LATCH (0x83e2) is 0 the machine has no coin "in flight". Store whichever coin/
  // service lines are pressed right now (masked) into the latch and return. With nothing pressed this
  // stores 0 and stays idle; a real coin stores its slot bit, arming the credit-on-release logic below.
  if (mem8[COIN_INPUT_LATCH] === 0) {
    mem8[COIN_INPUT_LATCH] = notIn0 & COIN_SERVICE_MASK;
    return;
  }

  // ── Wait for the release edge ─────────────────────────────────────────────────────────
  // The latch is armed. If any masked coin/service bit is still high the coin is still being held, so
  // do nothing this frame — we only credit once the player lets go (the second half of the debounce).
  if ((notIn0 & COIN_SERVICE_MASK) !== 0) return;

  // ── Release edge reached: this coin now pays out ──────────────────────────────────────
  // Announce the coin with sound command 1 (the "coin drop" blip).
  issueSoundCommand(m, 1);

  // COINAGE_WORD (0x83d4) is the coinage DIP setting, one of {0,2,4,6}; it indexes how many coins buy a
  // credit for each slot. The latch still holds which slot the coin fell into (it is cleared below).
  const coinage = mem16[COINAGE_WORD];
  const latch = mem8[COIN_INPUT_LATCH];

  let credit;
  if ((latch & SLOT2_BIT) !== 0) {
    // ── Slot 2 ──────────────────────────────────────────────────────────────────────────
    // Disarm the latch (ready for the next coin), then pulse the slot-2 mechanical coin counter:
    // raise COIN_COUNTER_1 (0xb81c) and seed its pulse timer COIN_PULSE_TIMER_1 (0x837f) so the NMI
    // drops the latch after COIN_PULSE frames. Then look up slot 2's credit for this coinage.
    mem8[COIN_INPUT_LATCH] = 0;
    mem8[COIN_COUNTER_1] = 1;
    mem8[COIN_PULSE_TIMER_1] = COIN_PULSE;
    credit = creditForSlot2(m, coinage);
  } else {
    // ── Slot 1 (and the service switch) ───────────────────────────────────────────────────
    // Read the service bit BEFORE clearing the latch: a free-play service coin (SKIP_COUNTER_BIT 0x04)
    // grants credit but must NOT advance the mechanical counter, so we skip the coin-counter pulse for
    // it. A real slot-1 coin pulses COIN_COUNTER_0 (0xb818) via COIN_PULSE_TIMER_0 (0x837e), like slot 2.
    const skipCounter = (latch & SKIP_COUNTER_BIT) !== 0;
    mem8[COIN_INPUT_LATCH] = 0;
    if (!skipCounter) {
      mem8[COIN_COUNTER_0] = 1;
      mem8[COIN_PULSE_TIMER_0] = COIN_PULSE;
    }
    credit = creditForSlot1(m, coinage);
  }

  // The every-other-coin coinages (see the credit tables) return null when this is the odd coin of a
  // two-coins-per-credit pair: it counted but pays no credit yet, so there is nothing to add or start.
  if (credit === null) return;
  return addCreditAndMaybeStart(m, credit);
}

// ── The "two coins per credit" gate ──────────────────────────────────────────────────────
// For coinages that charge two coins per credit, COIN_PAIR_TOGGLE (0x83e3) counts coins across frames.
// Bump it; grant one credit only on the even count (the second coin of each pair), and return null on
// the odd count so the caller adds nothing this time.
function everyOtherCoin(m) {
  const count = (m.mem8[COIN_PAIR_TOGGLE] + 1) & 0xff;
  m.mem8[COIN_PAIR_TOGGLE] = count;
  return (count & 1) === 0 ? 1 : null;
}

// Slot-1 coinage table: 0 → 1 credit/coin, 2 and 4 → two coins per credit, 6 → 1 credit/coin.
function creditForSlot1(m, coinage) {
  switch (coinage) {
    case 0: return 1;
    case 2: return everyOtherCoin(m);
    case 4: return everyOtherCoin(m);
    case 6: return 1;
    default: throw new Error(`scanCoinInputAndCredit: coinage 0x${coinage.toString(16)} outside {0,2,4,6}`);
  }
}

// Slot-2 coinage table: 0 → 1, 2 → two coins per credit, 4 → 3 credits/coin, 6 → 6 credits/coin (the
// "bonus" slot, so a single coin in slot 2 can be worth several credits).
function creditForSlot2(m, coinage) {
  switch (coinage) {
    case 0: return 1;
    case 2: return everyOtherCoin(m);
    case 4: return 3;
    case 6: return 6;
    default: throw new Error(`scanCoinInputAndCredit: coinage 0x${coinage.toString(16)} outside {0,2,4,6}`);
  }
}

// Bank the earned credit and, if idle, drop the machine into the player-select screen.
function addCreditAndMaybeStart(m, credit) {
  const { mem8 } = m;

  // ── Add to the packed-BCD credit total, clamped at 99 ─────────────────────────────────
  // CREDIT_BCD (0x83e1) is a two-digit packed-BCD count. bcdAddByte does the DAA-style add; a BCD carry
  // means the total would pass 99, so we pin it at CREDIT_CLAMP (0x99) rather than let it wrap.
  const sum = bcdAddByte(mem8[CREDIT_BCD], credit);
  mem8[CREDIT_BCD] = sum.carry ? CREDIT_CLAMP : sum.value;

  // ── If a game is already running, we're done ──────────────────────────────────────────
  // PLAY_FLAG (0x83fe) non-zero means a game is in progress. A coin dropped mid-game just tops up the
  // credit count (for a continue / second player); it must not disturb the running game's mode or RAM.
  if (mem8[PLAY_FLAG] !== 0) return;

  // ── Otherwise, present the player-select screen ───────────────────────────────────────
  // Force GAME_MODE (0x83d6) to the player-select mode 5. If the machine was ALREADY in mode 5, the
  // "insert coin" prompt is on screen and must be refreshed, so blit the player-select prompt first
  // (blitPlayerSelectPrompt). Then clear the point-table draw state POINT_TABLE_DRAW_STATE (0x83d8),
  // wipe the WORK_BLOCK_LEN-byte fly/object work block from FLY_SPRITE_X (0x8040) so no stale attract
  // sprite carries over, and redraw the credit line so the new CREDIT count shows immediately.
  if (mem8[GAME_MODE] === SELECT_MODE) blitPlayerSelectPrompt(m);
  mem8[GAME_MODE] = SELECT_MODE;
  mem8[POINT_TABLE_DRAW_STATE] = 0;
  for (let i = 0; i < WORK_BLOCK_LEN; i++) mem8[(FLY_SPRITE_X + i)] = 0;
  return renderCreditLine(m);
}
