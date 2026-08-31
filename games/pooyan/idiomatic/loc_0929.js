// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { blankFillRowAndStepCounter } from "./blankFillRowAndStepCounter.js";
import { armTileFillFromPlayfieldBase } from "./armTileFillFromPlayfieldBase.js";
import { zeroSpriteListAndActorArena } from "./zeroSpriteListAndActorArena.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { fillAttributeColumns } from "./fillAttributeColumns.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import {
  ATTRACT_SUBSTATE,
  COPY_PROTECT_STALL_BYTE,
  SIGNATURE_EXPECTED_TOP,
  SIGNATURE_WORD_TABLE,
  FIELD_ATTRIB_SRC_07D9,
  DISPLAY_CMD_068B,
  DISPLAY_CMD_068E,
  DISPLAY_CMD_0200,
} from "./names.js";
/**
 * loc_0929 — guarded screen/attribute setup with an overlapping-decode protection arm.
 *
 * WHAT IT IS
 *   A screen-build step from the attract sequence that stitches together three jobs: it lays down
 *   one blank tile row of the playfield, it clears the moving-object RAM, and it repaints the whole
 *   colour/attribute map before pushing a small batch of draw commands out to the screen. Wrapped
 *   around all of that is one strand of the game's anti-tamper lattice: before it touches the
 *   attribute map it waits for a hardware handshake cell and then re-verifies a seven-entry ROM
 *   signature, so a corrupted program image is caught here instead of drawing a screen.
 *
 * ROLE IN THE MACHINE
 *   This is the front-end of a board/attract redraw. The blank row it fills is one slice of the
 *   incremental screen wipe that other attract handlers drive a row at a time; the display commands
 *   it queues are what actually make the tile and attribute changes visible on the next drain of the
 *   display-command ring. Its integrity check is one of several sprinkled through the boot and
 *   attract code: if the ROM has been altered, the signature comparison diverts control away from
 *   normal drawing forever, so a bootleg board never reaches a playable screen.
 *
 * ROM ADDRESS: 0x0929–0x0975.
 * GROUNDING: [code] — the behaviour is read from the program image; the guard arms it protects (the
 *   carry-set overlapping-decode entry and the signature-mismatch trap) are only reached on a
 *   tampered ROM, i.e. never during normal play, so there is no run-time observation of them.
 *
 * LIVE-OUT (memory only; register outputs are dead — every caller reloads them):
 *   - one bumped counter: on the normal arm the attract sub-state cell ATTRACT_SUBSTATE (0x8e51),
 *     on the protection arm the byte at the incoming pointer;
 *   - the zeroed sprite display list + actor/object arena;
 *   - the freshly flooded colour/attribute map;
 *   - three two-byte commands appended to the display-command ring.
 *
 * BRIDGED INPUTS: the entry carry flag (selects which arm runs) and the entry pointer (the cell the
 *   protection arm bumps).
 */
const FILL_ROW_BLANKS = 0x19; //   0x19 = 25 blank tiles, one full playfield row's worth
const SIGNATURE_COUNT = 7; //      seven ROM signature entries are checked, top-down
const ENTRY_OFFSET = 0x1c; //      byte offset added to each looked-up word to reach the compared byte
const STALL_READY = 0x11; //       value the copy-protection handshake cell (0x07f5) must reach

export function loc_0929(m, carry = m.regs.fC, ptr = m.regs.hl) {
  const { mem8 } = m;

  // Branch on the entry carry. The normal (carry-clear) arm is the real screen-build path. The
  // carry-set arm is an overlapping-instruction landing: on the hardware the carry branch jumps into
  // the middle of a later instruction's operand bytes, and those bytes decode into an increment of
  // the cell the entry pointer names. It is a protection artefact — reached only on a tampered image
  // — but both arms then converge on the shared integrity-and-redraw tail below.
  if (carry) {
    mem8[ptr] = mem8[ptr] + 1; // overlapping-decode arm: bump the incoming cell (write wraps to a byte)
  } else {
    // Paint one blank tile row at the current fill cursor and step the row counter down by one. If
    // the counter has not yet drained (more rows still to wipe) this build slice is finished for this
    // pass, so bail and let the next pass continue the wipe.
    if (!blankFillRowAndStepCounter(m, FILL_ROW_BLANKS)) return; // row counter not drained -> bail
    // Counter drained: the wipe finished this pass, so re-arm the tile fill back at the fixed VRAM
    // start (0x8402) so the next screen build begins from the top of the playfield.
    armTileFillFromPlayfieldBase(m);
    // Advance the attract sequence one step by bumping the attract sub-state selector (0x8e51); the
    // attract dispatcher reads this cell to pick the next attract screen.
    mem8[ATTRACT_SUBSTATE] = mem8[ATTRACT_SUBSTATE] + 1;
  }

  // Shared tail (both arms). Clear the moving-object RAM — the sprite display list and the
  // actor/object arena — so the rebuilt screen starts with no stale sprites or object records.
  zeroSpriteListAndActorArena(m);

  // Copy-protection handshake: spin until the stall cell (0x07f5) reads its ready value (0x11). On
  // the hardware this cell is driven to 0x11 by a cooperating routine; a genuine board reaches it
  // promptly, so this is a synchronisation gate rather than a busy delay.
  while (mem8[COPY_PROTECT_STALL_BYTE] !== STALL_READY) { /* stall until ready */ }

  // ROM signature verification. Walk seven entries top-down: `entry` starts at SIGNATURE_EXPECTED_TOP
  // (0x0838) and counts down, giving the expected-value side of each comparison. For each index the
  // signature word table (0x0976) yields a little-endian word; adding ENTRY_OFFSET (0x1c) forms a
  // pointer to the byte that must match. Any mismatch means the program image has been altered: on the
  // hardware control diverts into the word-table bytes and executes them as garbage, so a tampered
  // ROM never returns to normal drawing. That divergence is unreachable with an intact image.
  let entry = SIGNATURE_EXPECTED_TOP;
  for (let index = SIGNATURE_COUNT; index >= 1; index--) {
    const word = fetchWordFromTableIndex(m, index, SIGNATURE_WORD_TABLE);
    const expected = mem8[u16(word + ENTRY_OFFSET)];
    if (mem8[entry] !== expected) throw new Error("loc_0929: ROM signature mismatch (integrity guard)");
    entry = u16(entry - 1);
  }

  // Signature verified: flood the whole colour/attribute map from the ROM field-attribute source
  // (0x07d9), giving the rebuilt playfield its per-cell colours.
  fillAttributeColumns(m, FIELD_ATTRIB_SRC_07D9);

  // Queue the three display commands that make this rebuild visible on the next ring drain. Each is a
  // two-byte command word appended to the page-0x88 display-command ring.
  enqueueDisplayCommand(m, DISPLAY_CMD_068B);
  enqueueDisplayCommand(m, DISPLAY_CMD_068E);
  enqueueDisplayCommand(m, DISPLAY_CMD_0200);
}
