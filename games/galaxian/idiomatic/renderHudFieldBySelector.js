// SPDX-License-Identifier: GPL-3.0-only
//
// renderHudFieldBySelector -- ROM 0x24b7, grounding [seen]. This is channel 7, the HUD field painter.
//
// WHAT IT IS
//   A four-way switch on a selector argument (register A) that repaints ONE HUD element per call:
//     sel 0 -> the coin/credit icon-tally row.
//     sel 1 -> the credit-count digits line.
//     sel 2 -> the two-nibble convoy/level status readout.
//     else  -> the bonus-marker row.
//   Each arm stamps BCD/nibble digits into tilemap VRAM through the shared tile helpers (drawTileBlock2x2,
//   stampTilePair, drawFixedTilePairHorizontal) or hands a label column to renderMessageColumn.
//
// ROLE IN THE MACHINE
//   Reached from the display-list drain loop, which rescans after each handler returns, so a burst of
//   these repaints the whole HUD. The coin-line and marker-row arms are gated by the frame-parity skip
//   flag loc_4007 bit 0 (the dissolved rst-08 caller-skip): on odd frames they return without drawing,
//   halving their redraw rate. The credit-count line is gated by loc_4006 bit 0 instead.
//
// KEY CELLS
//   COIN_CREDIT_ROW_COUNT (0x421c) tally, COIN_CREDIT_ROW_VRAM (0x507e) row base; loc_4002 credit count
//   into CREDIT_COUNT_TENS_VRAM (0x529f)/CREDIT_COUNT_UNITS_VRAM (0x527f); loc_40ac status byte (0xff
//   sentinel = nothing) into HUD_NIBBLE_LO_VRAM (0x5138)/HUD_NIBBLE_HI_VRAM (0x5158); loc_421d marker
//   count. loc_4220 region flag requests a sound-LFO reset via SOUND_LFO_RESET_REQUEST (0x41d0).
//
// LIVE-OUT: the VRAM cells of whichever field was painted (plus SOUND_LFO_RESET_REQUEST in the coin arm).
import { byteToPackedBcd } from "./byteToPackedBcd.js";
import { drawTileBlock2x2 } from "./drawTileBlock2x2.js";
import { stampTilePair } from "./stampTilePair.js";
import { drawFixedTilePairHorizontal } from "./drawFixedTilePairHorizontal.js";
import { renderMessageColumn } from "./renderMessageColumn.js";
import { drawMarkerRow } from "./drawMarkerRow.js";
import { u8 } from "../../../core/int.js";
import {
  loc_4007,
  loc_4220,
  COIN_CREDIT_ROW_COUNT,
  loc_421d,
  loc_40ac,
  loc_4006,
  loc_4002,
  IN1_SHADOW,
  SOUND_LFO_RESET_REQUEST,
  COIN_CREDIT_ROW_VRAM,
  HUD_NIBBLE_LO_VRAM,
  HUD_NIBBLE_HI_VRAM,
  CREDIT_COUNT_TENS_VRAM,
  CREDIT_COUNT_UNITS_VRAM,
} from "./names.js";

const CREDIT_CEIL = 0x30; // credit-line count ceiling
const COIN_SLOTS = 0x10; // coin-line slot budget (2 per tens tile, 1 per units tile)
const TENS_TILE = 0x68; // 2x2 tens-digit tile seed
const UNITS_TILE = 0x6c; // units-digit tile seed
const PAIR_STRIDE = 0x1f; // VRAM stride between stamped tile pairs
const CREDIT_LINE_CEIL = 0x63; // credit-count line value ceiling (99 dec)
const CONVOY_SENTINEL = 0xff; // == 0xff -> nothing to show

export function renderHudFieldBySelector(m, sel = m.regs.a) {
  const { mem8 } = m;

  if (sel === 0) {
    // ── coin/credits line ──────────────────────────────────────────────────────────
    if (mem8[loc_4007] & 1) return; // frame-parity caller-skip

    // On the region flag, ask the sound engine to reset its LFO (a UI-driven side effect of drawing this
    // row); loc_4220 gates it so the request only fires in the appropriate attract/service region.
    if (mem8[loc_4220] !== 0) mem8[SOUND_LFO_RESET_REQUEST] = 1;

    // The drawn value is the tally + 1, clamped to CREDIT_CEIL (0x30), then converted to packed BCD so
    // the tens and units digits can be stamped separately below.
    let count = u8(mem8[COIN_CREDIT_ROW_COUNT] + 1);
    if (count >= CREDIT_CEIL) count = CREDIT_CEIL;
    const packed = byteToPackedBcd(m, count);

    // Start the destination at the row base and choose a slot budget. Sixteen slots make up the row;
    // each 2x2 tens block consumes two, each units pair one, and any leftover slots get blanked below.
    let dst = COIN_CREDIT_ROW_VRAM;
    let slots;
    if (packed & 0xf0) {
      // Tens digit present: budget the full 16 slots and stamp one 2x2 tens tile per tens count,
      // threading `dst` forward from each block's returned HL and spending two slots each.
      slots = COIN_SLOTS;
      let tens = packed >> 4;
      do {
        dst = drawTileBlock2x2(m, TENS_TILE, dst).hl;
        slots -= 2;
        tens -= 1;
      } while (tens !== 0);
    } else {
      slots = packed; // the byte-to-BCD helper left the units count in C (packed < 0x10 here)
    }

    // Units digit: stamp one tile pair per unit, each spending a single slot and advancing `dst`.
    let units = packed & 0x0f;
    if (units !== 0) {
      do {
        dst = stampTilePair(m, UNITS_TILE, dst, PAIR_STRIDE).hl;
        slots -= 1;
        units -= 1;
      } while (units !== 0);
    }

    // Blank the rest of the row: keep stamping fixed tile pairs until the slot counter underflows past
    // zero, so the tally always occupies a fixed-width field regardless of how many digits it drew.
    for (;;) { // blank the remaining slots until the signed slot counter goes negative
      slots -= 1;
      if (slots < 0) return;
      dst = drawFixedTilePairHorizontal(m, dst, PAIR_STRIDE).hl;
    }
  }

  if (sel === 1) {
    // ── credit-count line ──────────────────────────────────────────────────────────
    if (mem8[loc_4006] & 1) return; // bit0 of set -> skip

    // Both IN1 dip bits set means free play: paint the "free play" label column (index 0x10) and return
    // WITHOUT any credit digits. Otherwise paint the "credit" label column (index 0x05), then the count.
    if ((mem8[IN1_SHADOW] & 0xc0) === 0xc0) return renderMessageColumn(m, 0x10); // both dip bits
    renderMessageColumn(m, 0x05);

    // Read the credit count, clamp to 99 (0x63), and convert to packed BCD. The tens cell is written
    // only when nonzero (leading-zero suppression); the units cell is always written.
    let value = mem8[loc_4002];
    if (value >= CREDIT_LINE_CEIL) value = CREDIT_LINE_CEIL;
    const packed = byteToPackedBcd(m, value);
    if (packed & 0xf0) mem8[CREDIT_COUNT_TENS_VRAM] = packed >> 4; // tens digit
    mem8[CREDIT_COUNT_UNITS_VRAM] = packed & 0x0f; // units digit
    return;
  }

  if (sel === 2) {
    // ── convoy/level nibble readout ─────────────────────────────────────────────────
    // The status byte 0x40ac carries a 0xff "nothing to show" sentinel -> skip entirely. Otherwise paint
    // the label column (index 0x06), then split the byte into two nibbles across two VRAM cells.
    if (mem8[loc_40ac] === CONVOY_SENTINEL) return;
    renderMessageColumn(m, 0x06);
    const conv = mem8[loc_40ac];
    mem8[HUD_NIBBLE_LO_VRAM] = conv & 0x0f; // low nibble
    // High nibble: swap it down into the low position (the Z80 did this with four rrca rotates) so the
    // byte store leaves the digit tile; a zero high nibble is bumped to tile 0x10 rather than left blank.
    let hi = conv & 0xf0;
    if (hi === 0) hi = 1; // high nibble 0 renders tile 0x10
    mem8[HUD_NIBBLE_HI_VRAM] = (hi >> 4) | (hi << 4); // nibble swap (rrca x4); the byte store truncates
    return;
  }

  // ── default (sel >= 3): marker-row redraw ──────────────────────────────────────────
  // Bonus-marker row: read the marker count loc_421d (bumped by awardBonusMarker) and, unless the
  // odd-frame skip flag is set, hand it to drawMarkerRow to repaint the little award markers.
  const markers = mem8[loc_421d];
  if (mem8[loc_4007] & 1) return; // frame-parity caller-skip
  return drawMarkerRow(m, markers);
}
