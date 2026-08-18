// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampHomeGoalAndResetFrog  —  ROM 0x1f1c  ·  grounding: [seen]  (MAME-grounded)
 *
 * WHAT IT IS
 *   The shared "frog reached a home bay" handler: the one routine that fills a home bay with the
 *   frog-in-home graphic, banks the arrival score and jingle, and reseeds the frog object so the next
 *   frog starts fresh at the bottom of the board. It runs once each time the frog completes a bay.
 *
 * WHERE IT SITS
 *   It is the tail of the five bay-goal handlers awardHomeBay1Goal..awardHomeBay5Goal (one shared body,
 *   ROM 0x1d87..0x1ecb). Once a handler decides the frog has genuinely landed in its column band it
 *   passes that bay's slot VRAM base in HL and calls here to do the visible fill and the frog reset. The
 *   caller then — AFTER we return — sets the bay's occupancy gate and increments the player's home tally.
 *   That ordering is why the "final bay" test below compares the tally against 4, not 5.
 *
 * LIVE-OUT
 *   Memory only. It writes VRAM tiles, score/sound cells, and the frog-object + hop/countdown state, and
 *   returns nothing. HL is threaded internally (default = the caller's slot base in m.regs.hl) but is not
 *   read back by the caller.
 */
import { COLLISION_SUBFLAG, PLAY_FLAG, ACTIVE_PLAYER, PLAYER1_SLOT, PLAYER2_SLOT, HOME_COLUMN_STATE, FLY_SPRITE_X, FROG_X, FROG_SPRITE_CODE, FROG_Y, FROG_HOP_UP_ARRIVAL, FROG_HOP_UP_ACTIVE, FROG_HOP_UP_ANIM_COUNTER, FROG_HOP_INPUT_TIMER, GATED_COUNTDOWN_COUNTER, GATED_COUNTDOWN_ENABLE_FLAG, FROG_STATE_DEMO_FLAG, INTRO_COUNTER_829B, BOARD_LAYOUT_GATE, FROG_OBJ_ATTR, FANFARE_TABLE, FANFARE_INDEX, SOUND_SEQUENCE_COUNTDOWN, OBJRAM_FLY_SPRITE_BASE } from "./names.js";
import { addScoreAndAwardExtraLife } from "./addScoreAndAwardExtraLife.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";
import { clearActivePlayerWorkRam } from "./clearActivePlayerWorkRam.js";
import { clearCollisionSpriteBlock } from "./clearCollisionSpriteBlock.js";
import { armScoreBonusStrip } from "./driveScoreDisplayCountdown.js";
import { u16 } from "../../../core/int.js";

// The frog-reached-home graphic is a 2x2 tile quad: HOME_TILE and HOME_TILE+1 across the top row,
// HOME_TILE+2 and HOME_TILE+3 on the row one tilemap row (32 cells) below.
const HOME_TILE = 0x6c;

// Score deltas, both BCD. BONUS_DELTA is the extra fly-eat bonus banked when the frog arrives home with a
// collision still latched; HOME_DELTA is the flat bonus every home arrival is worth.
const BONUS_DELTA = 0x20, HOME_DELTA = 0x05;

// The active player's home tally (PLAYER1_SLOT 0x825c / PLAYER2_SLOT 0x825d) still reads 4 at this point
// on the arrival that fills the FIFTH and last bay, because the goal handler increments it only AFTER we
// return. So a tally of 4 here means "this is the final bay" -> tear down the board's per-player scratch.
const FINAL_HOME_TALLY = 0x04;

// Bytes of the fly/frog OBJRAM sprite region (OBJRAM_FLY_SPRITE_BASE 0xb040) wiped on the final bay.
const FLY_OBJRAM_CLEAR_LEN = 0x18;

// The arrival-fanfare cursor (FANFARE_INDEX 0x8381) counts DOWN 0x14..1 and wraps back to 0x14 — a
// 1-based index over the 20-entry fanfare pointer table.
const FANFARE_INDEX_WRAP = 0x14;

export function stampHomeGoalAndResetFrog(m, hl = m.regs.hl) {
  const { mem8, mem16 } = m;

  // ── Fly-eat bonus: did the frog arrive home mid-collision? ────────────────────────────
  // COLLISION_SUBFLAG (0x8134) is nonzero when a fly-eat collision was latched as the frog reached the
  // bay. In that case bank the extra fly bonus (BONUS_DELTA, BCD) via addScoreAndAwardExtraLife (ROM
  // 0x08e0) and tear down the fly/goal sprite block via clearCollisionSpriteBlock (ROM 0x27bc — zeroes
  // FLY_SPRITE_X..+3, 0x8040-0x8043, and the collision latch 0x8135). In the ROM that clear routine
  // walks its pointer to the block's last cell and leaves HL there; the JS helper returns nothing, so we
  // reconstruct that value ourselves — FLY_SPRITE_X + 3 (0x8043) — and stamp the home graphic from there.
  // (Faithful to the ROM: the collision path stamps the tiles into the sprite-block region in work RAM,
  // not into the bay's VRAM slot.)
  if (mem8[COLLISION_SUBFLAG] !== 0) {
    addScoreAndAwardExtraLife(m, BONUS_DELTA);
    clearCollisionSpriteBlock(m);
    hl = u16(FLY_SPRITE_X + 3);
  }

  // ── Stamp the 2x2 frog-in-home graphic at the target base ─────────────────────────────
  // Walk HL exactly as the ROM does: top-left, +1 for top-right, then +0x1f to drop to the bottom-left
  // (one 32-cell tilemap row down, minus the +1 already applied), +1 for bottom-right. In the normal path
  // HL is the caller's bay slot VRAM base (e.g. HOME_SLOT1_VRAM 0xab64); in the collision path it is the
  // sprite-block cell fixed just above.
  mem8[hl] = HOME_TILE;
  hl = u16(hl + 1);
  mem8[hl] = HOME_TILE + 1;
  hl = u16(hl + 0x1f);
  mem8[hl] = HOME_TILE + 2;
  hl = u16(hl + 1);
  mem8[hl] = HOME_TILE + 3;

  // ── Bank the flat home bonus and refresh the score strip ──────────────────────────────
  // Every home arrival is worth HOME_DELTA (BCD 0x05); armScoreBonusStrip (ROM 0x08c5) blits the bonus
  // strip and cashes the pending bonus into the on-screen score.
  addScoreAndAwardExtraLife(m, HOME_DELTA);
  armScoreBonusStrip(m);

  // ── In-play-only bookkeeping (skipped during attract) ─────────────────────────────────
  // PLAY_FLAG (0x83fe) is 0 in attract and 1/2 during a real game. The sound and board-teardown work
  // below only makes sense in a live game, so attract falls straight through to the frog reset.
  if (mem8[PLAY_FLAG] !== 0) {
    // Queue the arrival jingle: clear the sound-sequence countdown (SOUND_SEQUENCE_COUNTDOWN 0x8382, the
    // NMI's per-sequence timer) so the new sequence starts immediately, then enqueue the jingle command
    // pair 0x00 / 0xf0 into the sound queue.
    mem16[SOUND_SEQUENCE_COUNTDOWN] = 0;
    enqueueSoundCommand(m, 0x00);
    enqueueSoundCommand(m, 0xf0);

    // Pick the active player's home-tally cell: PLAYER1_SLOT (0x825c) for player 1, PLAYER2_SLOT (0x825d)
    // otherwise (ACTIVE_PLAYER 0x83fd names the player).
    const homeTallyCell = mem8[ACTIVE_PLAYER] === 1 ? PLAYER1_SLOT : PLAYER2_SLOT;

    if (mem8[homeTallyCell] === FINAL_HOME_TALLY) {
      // ── Final (fifth) bay just filled: tear down this player's board scratch ───────────
      // Mirror the tally into HOME_COLUMN_STATE (0x842f) — the sprite-DMA blit reads this cell to choose
      // which sprite region it copies — then wipe the active player's work RAM, zero the fly OBJRAM block
      // (OBJRAM_FLY_SPRITE_BASE 0xb040, FLY_OBJRAM_CLEAR_LEN bytes), and clear the collision sprite block
      // once more. The left-to-right "all frogs home" reveal (driven elsewhere) takes over from here.
      mem8[HOME_COLUMN_STATE] = mem8[homeTallyCell];
      clearActivePlayerWorkRam(m);
      for (let i = 0; i < FLY_OBJRAM_CLEAR_LEN; i++) mem8[OBJRAM_FLY_SPRITE_BASE + i] = 0;
      clearCollisionSpriteBlock(m);
    } else {
      // ── A non-final bay: advance to the next arrival fanfare ───────────────────────────
      // Enqueue the fanfare command pair 0x08 / 0x0e into the sound queue, then step the fanfare cursor
      // and load its duration pointer.
      enqueueSoundCommand(m, 0x08);
      enqueueSoundCommand(m, 0x0e);

      // Step FANFARE_INDEX (0x8381) down by one; when it would reach 0 wrap it back to FANFARE_INDEX_WRAP
      // so the 1-based cursor stays in 1..0x14.
      let idx = (mem8[FANFARE_INDEX] - 1) & 0xff;
      if (idx === 0) idx = FANFARE_INDEX_WRAP;
      mem8[FANFARE_INDEX] = idx;

      // Read this fanfare's little-endian duration pointer from FANFARE_TABLE (0x2e87), two bytes per
      // entry. This mirrors the Z80's 8-bit pointer walk: the table's page (0x2e00) stays fixed and only
      // the low byte advances, wrapping within the page — hence the `& 0xff` on the running low byte.
      const page = FANFARE_TABLE & ~0xff;
      let lowByte = (FANFARE_TABLE + 2 * idx) & 0xff;
      const lo = mem8[page | lowByte];
      lowByte = (lowByte + 1) & 0xff;
      const hi = mem8[page | lowByte];

      // Seed the sound-sequence countdown (0x8382) with that 16-bit duration; the NMI counts it down and
      // fires the fanfare's end-of-sequence sound when it drains.
      mem16[SOUND_SEQUENCE_COUNTDOWN] = lo | (hi << 8);
    }
  }

  // ── Reseed the frog object and hop/countdown state for the next frog ───────────────────
  // Arm the gated countdown (GATED_COUNTDOWN_COUNTER 0x826a = 0x20 frames) and enqueue its sound command
  // 0x80; then park the frog off-screen and clear its per-hop state so the next frog spawns clean.
  mem8[GATED_COUNTDOWN_COUNTER] = 0x20;
  enqueueSoundCommand(m, 0x80);

  // Frog object block (FROG_X 0x8044 .. FROG_Y 0x8047): clear X, sprite/tile code and attribute, and park
  // Y at 0xf0 (below the visible screen) so nothing is drawn until the next frog is activated.
  mem8[FROG_X] = 0;
  mem8[FROG_SPRITE_CODE] = 0;
  mem8[FROG_OBJ_ATTR] = 0;
  mem8[FROG_Y] = 0xf0;

  // Clear the intro counter (INTRO_COUNTER_829B 0x829b) and request a fresh board layout
  // (BOARD_LAYOUT_GATE 0x83ea = 0 asks the board setup to re-lay the board for the incoming frog).
  mem8[INTRO_COUNTER_829B] = 0;
  mem8[BOARD_LAYOUT_GATE] = 0;

  // Clear the up-hop state (active flag FROG_HOP_UP_ACTIVE 0x8249, arrival mirror FROG_HOP_UP_ARRIVAL
  // 0x824d, anim counter FROG_HOP_UP_ANIM_COUNTER 0x8251) so the next frog's first upward hop starts from
  // rest.
  mem8[FROG_HOP_UP_ARRIVAL] = 0;
  mem8[FROG_HOP_UP_ACTIVE] = 0;
  mem8[FROG_HOP_UP_ANIM_COUNTER] = 0;

  // Enable the gated countdown (GATED_COUNTDOWN_ENABLE_FLAG 0x826c = 1, so tickGatedCountdown actually
  // drains the counter armed above) and set the frog-state / demo flag (FROG_STATE_DEMO_FLAG 0x83cd = 1).
  mem8[GATED_COUNTDOWN_ENABLE_FLAG] = 1;
  mem8[FROG_STATE_DEMO_FLAG] = 1;

  // Arm the hop-input lock (FROG_HOP_INPUT_TIMER 0x8268 = 0x10 frames): while it counts down joystick
  // input is ignored and each frame only steps the home-bay slot cursor, holding the frog still through
  // the brief arrival celebration.
  mem8[FROG_HOP_INPUT_TIMER] = 0x10;
}
