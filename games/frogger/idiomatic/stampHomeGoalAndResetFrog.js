// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampHomeGoalAndResetFrog — the shared home-goal fill and frog reset, reached once the frog is
 * awarded a home bay. When a collision is latched it first adds the bonus score and clears the
 * sprite block; it stamps the 2x2 home tiles at the caller's slot HL, adds the home bonus, and
 * refreshes the score display. In play mode it also queues the arrival jingle and, on this player's
 * fourth home, clears the player work RAM and a board strip, else selects the next fanfare pointer.
 * Finally it reseeds the frog object (X/sprite/attr cleared, Y parked off-screen) and the up-hop and
 * countdown state so the next frog starts fresh. LIVE-OUT: memory-only.
 */
import {
  COLLISION_SUBFLAG, PLAY_FLAG, ACTIVE_PLAYER, PLAYER1_SLOT, HOME_COLUMN_STATE,
  FROG_X, FROG_SPRITE_CODE, FROG_Y,
  FROG_HOP_UP_ARRIVAL, FROG_HOP_UP_ACTIVE, FROG_HOP_UP_ANIM_COUNTER, FROG_HOP_INPUT_TIMER,
  loc_826a, loc_826c, loc_83cd, loc_829b, loc_83ea,
} from "./names.js";
import { addScoreAndAwardExtraLife } from "./addScoreAndAwardExtraLife.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";
import { clearActivePlayerWorkRam } from "./clearActivePlayerWorkRam.js";

const PLAYER2_SLOT = 0x825d;   // player-2 home count (sibling of the player-1 slot cell)
const FROG_OBJ_ATTR = 0x8046;  // frog object attribute byte (between the sprite code and Y)
const FANFARE_INDEX = 0x8381;  // arrival-fanfare index, reloaded on wrap
const FANFARE_PTR = 0x8382;    // arrival-fanfare pointer word

const FANFARE_TABLE = 0x2e87;  // fanfare pointer table base
const BOARD_CLEAR_STRIP = 0xb040;
const CLEAR_COLLISION = 0x27bc; // clears the sprite/collision block (kept dispatch)
const REFRESH_DISPLAY = 0x08c5; // score-display refresh, interior entry (kept dispatch)
const BONUS_DELTA = 0x0020, HOME_DELTA = 0x0005;

export function stampHomeGoalAndResetFrog(m) {
  const { regs, mem8, mem16 } = m;

  if (mem8[COLLISION_SUBFLAG] !== 0) {
    regs.de = BONUS_DELTA;
    addScoreAndAwardExtraLife(m);
    m.push16(0x1f2b); m.call(CLEAR_COLLISION);
  }

  mem8[regs.hl] = 0x6c;
  regs.hl = (regs.hl + 1) & 0xffff;
  mem8[regs.hl] = 0x6d;
  regs.hl = (regs.hl + 0x1f) & 0xffff;
  mem8[regs.hl] = 0x6e;
  regs.hl = (regs.hl + 1) & 0xffff;
  mem8[regs.hl] = 0x6f;
  const savedHl = regs.hl, savedDe = regs.de;

  regs.de = HOME_DELTA;
  addScoreAndAwardExtraLife(m);
  m.push16(0x1f44); m.call(REFRESH_DISPLAY);

  if (mem8[PLAY_FLAG] !== 0) {
    mem16[FANFARE_PTR] = 0;
    regs.a = 0x00; enqueueSoundCommand(m);
    regs.a = 0xf0; enqueueSoundCommand(m);

    const countCell = mem8[ACTIVE_PLAYER] === 1 ? PLAYER1_SLOT : PLAYER2_SLOT;
    if (mem8[countCell] === 0x04) {
      mem8[HOME_COLUMN_STATE] = mem8[countCell];
      clearActivePlayerWorkRam(m);
      for (let i = 0; i < 0x18; i++) mem8[(BOARD_CLEAR_STRIP + i) & 0xffff] = 0;
      m.push16(0x1f94); m.call(CLEAR_COLLISION);
    } else {
      regs.a = 0x08; enqueueSoundCommand(m);
      regs.a = 0x0e; enqueueSoundCommand(m);
      let idx = (mem8[FANFARE_INDEX] - 1) & 0xff;
      if (idx === 0) idx = 0x14;
      mem8[FANFARE_INDEX] = idx;
      let l = (0x87 + 2 * idx) & 0xff;
      const lo = mem8[(FANFARE_TABLE & 0xff00) | l];
      l = (l + 1) & 0xff;
      const hi = mem8[(FANFARE_TABLE & 0xff00) | l];
      mem16[FANFARE_PTR] = lo | (hi << 8);
    }
  }

  mem8[loc_826a] = 0x20;
  regs.a = 0x80; enqueueSoundCommand(m);
  mem8[FROG_X] = 0;
  mem8[FROG_SPRITE_CODE] = 0;
  mem8[FROG_OBJ_ATTR] = 0;
  mem8[FROG_Y] = 0xf0;
  regs.de = savedDe; regs.hl = savedHl;
  mem8[loc_829b] = 0;
  mem8[loc_83ea] = 0;
  mem8[FROG_HOP_UP_ARRIVAL] = 0;
  mem8[FROG_HOP_UP_ACTIVE] = 0;
  mem8[FROG_HOP_UP_ANIM_COUNTER] = 0;
  mem8[loc_826c] = 1;
  mem8[loc_83cd] = 1;
  mem8[FROG_HOP_INPUT_TIMER] = 0x10;
}
