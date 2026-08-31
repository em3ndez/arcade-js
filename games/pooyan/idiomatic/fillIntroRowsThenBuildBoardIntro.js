// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { fillByteRun } from "./fillByteRun.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { stampTwoPlaneColumnStrip } from "./stampTwoPlaneColumnStrip.js";
import { fillAttributeColumns } from "./fillAttributeColumns.js";
import { queueCreditDisplayCommands } from "./queueCreditDisplayCommands.js";
import { queueSoundCommands82And95 } from "./queueSoundCommands82And95.js";
import {
  TILE_FILL_PTR,
  FILL_ROW_COUNTER,
  PLAY_STATE_INDEX,
  ACTIVE_PLAYER,
  BONUS_AWARD_DSW,
  ATTRACT_FIELD_ATTRIB_SRC,
  DISPLAY_CMD_0601,
  OBJECT_SPAWN_DISPLAY_CMD,
  DISPLAY_CMD_0616,
  DISPLAY_CMD_0617,
  DISPLAY_CMD_0628,
  DISPLAY_CMD_062A,
  DISPLAY_CMD_0629,
} from "./names.js";
/**
 * fillIntroRowsThenBuildBoardIntro — board-build (level-intro) sub-state 1.  [seen]
 *
 * WHAT IT IS
 *   The ROM handler at 0x0c77. It is one leaf of the board-build sub-state machine, the sequence
 *   that runs while the master state selector MAIN_GAME_STATE (0x8805) holds 2 (board build). Each
 *   video interrupt the board-build dispatcher reads the sub-state index PLAY_STATE_INDEX (0x880a)
 *   and vectors here whenever it holds 1. The preceding handler (sub-state 0) seated the tile-fill
 *   write cursor at the top of the playfield and stepped the sub-state to 1, so by the time this runs
 *   the erase is already armed.
 *
 * ITS ROLE IN THE MACHINE
 *   Wiping a whole 32-row tile plane in one interrupt would overrun the frame, so the erase is
 *   spread out: this handler blanks just two short tile rows per call and returns, ticking a row
 *   countdown as it goes. The player sees the playfield clear a couple of rows at a time. On the
 *   single frame the countdown finally drains, it steps the sub-state forward and fires a one-shot
 *   "build the board intro" burst: an anti-tamper ROM checksum, the colour/attribute-plane flood,
 *   the credit-display commands, a two-plane column strip, a run of display commands that the main
 *   loop later drains to paint the intro, and two sound commands.
 *
 * GROUNDING: [seen] — the row-by-row tile fill (down-counter seeded, then decremented 32..0 per
 *   frame) and the sub-state stepping are confirmed roles.
 *
 * LIVE-OUT: none — a frame-interrupt state handler; only its memory writes survive. Those are the
 *   tile plane it blanks (video RAM 0x8400-0x87FF), the colour plane it floods (colour RAM
 *   0x8000-0x83FF), the fill cursor TILE_FILL_PTR (0x880b) and row counter FILL_ROW_COUNTER
 *   (0x8809), the sub-state index PLAY_STATE_INDEX (0x880a), and the display- and sound-command
 *   rings it appends to.
 */
const TILE_FILL_VALUE = 0x10; // blank tile-code stamped across each erase run (the empty-cell glyph)
const FILL_RUN_LEN = 0x1d; //   0x1d = 29 tile cells written per run
const FILL_RUN_GAP = 3; //      3-cell gap skipped between the two runs (edge margin of the playfield)

export function fillIntroRowsThenBuildBoardIntro(m) {
  const { mem8, mem16 } = m;

  // --- Erase two tile rows of the playfield ---
  // TILE_FILL_PTR (0x880b) is the 16-bit write cursor into the tile plane, left pointing at the next
  // cell to blank by the previous frame's pass. Stamp two runs of the blank tile (0x10) from it: each
  // fillByteRun writes FILL_RUN_LEN cells and returns the cursor advanced past them, and the +
  // FILL_RUN_GAP hops the short margin between runs. The advanced cursor is written back so the next
  // frame picks up where this one stopped.
  let cursor = mem16[TILE_FILL_PTR];
  cursor = u16(fillByteRun(m, cursor, TILE_FILL_VALUE, FILL_RUN_LEN) + FILL_RUN_GAP);
  cursor = u16(fillByteRun(m, cursor, TILE_FILL_VALUE, FILL_RUN_LEN) + FILL_RUN_GAP);
  mem16[TILE_FILL_PTR] = cursor;

  // --- Tick the erase countdown; bail until it drains ---
  // FILL_ROW_COUNTER (0x8809) counts the erase passes still owed (seeded as the fill is armed).
  // Decrement one pass; while it still holds, the playfield is not fully blank yet, so return and let
  // the next interrupt paint two more rows. Everything below runs on exactly the one frame the
  // counter reaches zero. Stepping PLAY_STATE_INDEX (0x880a) 1 -> 2 hands the following frame to the
  // next board-build handler, so the intro build below is a genuine one-shot.
  mem8[FILL_ROW_COUNTER] = u8(mem8[FILL_ROW_COUNTER] - 1);
  if (mem8[FILL_ROW_COUNTER] !== 0) return; // erase still in progress
  mem8[PLAY_STATE_INDEX] = u8(mem8[PLAY_STATE_INDEX] + 1);

  // --- Anti-tamper ROM checksum ---
  // Sum bytes of ROM starting at ATTRACT_FIELD_ATTRIB_SRC (0x0779) in repeated 256-byte passes,
  // keeping an 8-bit running total (acc) and a separate count of how many times the add overflowed
  // (carry). Keep folding in more passes until the running total lands on exactly 0xc1 with a carry
  // count of exactly 0x0c — the fingerprint of the intact colour/attribute + code region. A genuine
  // ROM converges on that (sum, carry) pair; a tampered image never hits both at once, so the loop
  // spins forever and the machine freezes here. The computed acc/carry are only the halting test and
  // are discarded afterward.
  let ptr = ATTRACT_FIELD_ATTRIB_SRC;
  let acc = mem8[ptr];
  let carry = 0;
  for (;;) {
    let count = 256; // one 256-byte pass
    do {
      ptr = u16(ptr + 1);
      const t = acc + mem8[ptr];
      if (t > 0xff) carry = u8(carry + 1); // overflow -> bump the carry tally
      acc = t & 0xff;
    } while (--count);
    if (acc !== 0xc1) continue; // running sum not yet at the sentinel -> fold in another pass
    acc = carry;
    if (acc !== 0x0c) continue; // sum matched but carry count wrong -> keep going
    break; // both match: image verified
  }

  // --- Flood the colour/attribute plane ---
  // fillAttributeColumns (0x075d) paints the colour plane one column at a time: 31 columns from
  // ATTRIB_MAP_BASE (0x8040), each flooded down all 30 rows at the 0x20 row stride from one source
  // byte of the ROM table at ATTRACT_FIELD_ATTRIB_SRC (0x0779) — one flat colour per screen column.
  // Its terminal register value (0x1f, the low bits of the last column address) is an incidental
  // leftover, not a player selection; it is written verbatim into ACTIVE_PLAYER (0x880d).
  mem8[ACTIVE_PLAYER] = fillAttributeColumns(m, ATTRACT_FIELD_ATTRIB_SRC); // store the leftover A (0x1f)

  // --- Queue the credit readout ---
  // queueCreditDisplayCommands (0x0e54) enqueues the primary credit-display command, plus an extra
  // command only when the coinage config marks free play.
  queueCreditDisplayCommands(m);

  // --- Stamp the two-plane column strip ---
  // stampTwoPlaneColumnStrip (0x0cf8) writes a compact self-describing strip that spans both the
  // tile and the colour plane in a single pass.
  stampTwoPlaneColumnStrip(m); // stamp the two-plane column table

  // --- Burst of display commands for the intro paint ---
  // Each enqueueDisplayCommand (0x0038) appends a two-byte command word into the display-command ring
  // at 0x88c0; the main loop drains the ring each frame and runs each command's painter, so these
  // stack up the board-intro graphics to be drawn over the next frames.
  enqueueDisplayCommand(m, DISPLAY_CMD_0601);
  enqueueDisplayCommand(m, OBJECT_SPAWN_DISPLAY_CMD); // the object-spawn command code
  enqueueDisplayCommand(m, DISPLAY_CMD_0616);

  // The last two intro commands come in a pair whose variant is picked by the bonus/extra-life award
  // schedule: BONUS_AWARD_DSW (0x8800) bit0 selects which of two award schedules is in force. Bit set
  // -> the 0x0628/0x0629 pair; bit clear -> the 0x0617/0x062a pair.
  const dsw = mem8[BONUS_AWARD_DSW] & 0x01;
  enqueueDisplayCommand(m, dsw ? DISPLAY_CMD_0628 : DISPLAY_CMD_0617);
  enqueueDisplayCommand(m, dsw ? DISPLAY_CMD_0629 : DISPLAY_CMD_062A);

  // --- Kick off the intro sounds ---
  // queueSoundCommands82And95 (0x0f4e) enqueues two fixed sound commands (0x82, 0x95) into the
  // sound-command ring for the audio processor.
  queueSoundCommands82And95(m);
  // (A second ROM checksum over ATTRACT_SCRIPT_TABLE_BASE (0x0b26) sat here in the original, but both
  // of its acting compare branches are disabled — the arithmetic runs and nothing acts on the result,
  // so it has zero durable effect and is omitted.)
}
