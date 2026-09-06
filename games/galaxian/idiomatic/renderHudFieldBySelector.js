// SPDX-License-Identifier: GPL-3.0-only
// HUD sub-dispatch on a selector: 0 = coin/credits line, 1 = credit-count line,
// 2 = convoy/level nibble readout, else = marker-row redraw. Each arm renders BCD/nibble digits
// into VRAM via the shared tile-stamp helpers; the coin and marker arms are gated by the
// frame-parity skip flag ( bit0 set -> early return, the dissolved rst-08 caller-skip).
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
    if (mem8[loc_4220] !== 0) mem8[SOUND_LFO_RESET_REQUEST] = 1;

    let count = u8(mem8[COIN_CREDIT_ROW_COUNT] + 1);
    if (count >= CREDIT_CEIL) count = CREDIT_CEIL;
    const packed = byteToPackedBcd(m, count);

    let dst = COIN_CREDIT_ROW_VRAM;
    let slots;
    if (packed & 0xf0) {
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

    let units = packed & 0x0f;
    if (units !== 0) {
      do {
        dst = stampTilePair(m, UNITS_TILE, dst, PAIR_STRIDE).hl;
        slots -= 1;
        units -= 1;
      } while (units !== 0);
    }

    for (;;) { // blank the remaining slots until the signed slot counter goes negative
      slots -= 1;
      if (slots < 0) return;
      dst = drawFixedTilePairHorizontal(m, dst, PAIR_STRIDE).hl;
    }
  }

  if (sel === 1) {
    // ── credit-count line ──────────────────────────────────────────────────────────
    if (mem8[loc_4006] & 1) return; // bit0 of set -> skip
    if ((mem8[IN1_SHADOW] & 0xc0) === 0xc0) return renderMessageColumn(m, 0x10); // both dip bits
    renderMessageColumn(m, 0x05);

    let value = mem8[loc_4002];
    if (value >= CREDIT_LINE_CEIL) value = CREDIT_LINE_CEIL;
    const packed = byteToPackedBcd(m, value);
    if (packed & 0xf0) mem8[CREDIT_COUNT_TENS_VRAM] = packed >> 4; // tens digit
    mem8[CREDIT_COUNT_UNITS_VRAM] = packed & 0x0f; // units digit
    return;
  }

  if (sel === 2) {
    // ── convoy/level nibble readout ─────────────────────────────────────────────────
    if (mem8[loc_40ac] === CONVOY_SENTINEL) return;
    renderMessageColumn(m, 0x06);
    const conv = mem8[loc_40ac];
    mem8[HUD_NIBBLE_LO_VRAM] = conv & 0x0f; // low nibble
    let hi = conv & 0xf0;
    if (hi === 0) hi = 1; // high nibble 0 renders tile 0x10
    mem8[HUD_NIBBLE_HI_VRAM] = (hi >> 4) | (hi << 4); // nibble swap (rrca x4); the byte store truncates
    return;
  }

  // ── default (sel >= 3): marker-row redraw ──────────────────────────────────────────
  const markers = mem8[loc_421d];
  if (mem8[loc_4007] & 1) return; // frame-parity caller-skip
  return drawMarkerRow(m, markers);
}
