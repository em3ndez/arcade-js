// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawGirderSpan — kind-2 arm of the board-layout walk: stamps a sloped girder run across the
 * tilemap. The screen is turned a quarter turn, so stepping the write pointer by a full row
 * (32 cells) lays a long sloped horizontal run on screen. Each row stamps the slope-band tile
 * (SEG_TILE, seeded from the record biased -0x10) and its paired half-tile, pays 8 px of height,
 * and adjusts the tile code to slant per SEG_RUN. Anything but kind 2 goes to the capped-column
 * drawer, which advances the record cursor itself.
 *
 * LIVE-OUT: the stamped tilemap cells, SEG_TILE and SEG_HEIGHT, plus the record cursor,
 * advanced past this record so the walk reads the next one.
 */

import { u16 } from "../../../core/int.js";
import {
  SEG_ADDR1, SEG_SUBTILE1, SEG_HEIGHT, SEG_RUN, SEG_KIND, SEG_TILE,
} from "./names.js";
import { drawCappedTileColumn } from "./drawCappedTileColumn.js";

export function drawGirderSpan(m) {
  const { regs, mem8, mem16 } = m;

  if (mem8[SEG_KIND] !== 0x02) {
    return drawCappedTileColumn(m);
  }

  mem8[SEG_TILE] = mem8[SEG_SUBTILE1] + 0xf0;

  let hl = mem16[SEG_ADDR1];

  function stamp(skipOnSentinel) {
    const t = mem8[SEG_TILE];
    mem8[hl] = t;
    hl = u16(hl + 1);
    if ((hl & 0x1f) === 0) return; // ran off the right edge of the row
    if (skipOnSentinel && t === 0xf0) return; // 0xF0 sentinel tile: no pair
    mem8[hl] = t - 0x10;
  }

  function descend() {
    hl = u16(hl + 0x1f);
    const h = mem8[SEG_HEIGHT];
    if (h < 0x08) return false;
    mem8[SEG_HEIGHT] = h - 0x08;
    return true;
  }

  let phase = "STAMP_ROW";
  for (;;) {
    if (phase === "STAMP_ROW") {
      stamp(true);
      phase = "DESCEND_A";
      continue;
    }

    if (phase === "DESCEND_A") {
      if (!descend()) break;
      if (mem8[SEG_RUN] === 0x00) {
        phase = "STAMP_ROW"; // straight run, no slant
        continue;
      }
      stamp(false); // slanting: second row, pair skipped only on a row boundary
      phase = "DESCEND_B";
      continue;
    }

    if (phase === "DESCEND_B") {
      if (!descend()) break;
      if (mem8[SEG_RUN] & 0x80) {
        phase = "SLANT_LEFT"; // x-delta negative
        continue;
      }
      // Positive slant: past the band (0xF8) wraps to 0xF0 and shifts one column on.
      const t = (mem8[SEG_TILE] + 1) & 0xff;
      mem8[SEG_TILE] = t;
      if (t === 0xf8) {
        hl = u16(hl + 1);
        mem8[SEG_TILE] = 0xf0;
      }
      phase = "ROW_CHECK";
      continue;
    }

    if (phase === "ROW_CHECK") {
      // Positive-slant only: a shift onto a row boundary ends the run.
      if ((hl & 0x1f) !== 0) {
        phase = "STAMP_ROW";
        continue;
      }
      break; // landed on a row boundary -> done
    }

    // SLANT_LEFT (fall-through): below the band re-seats to 0xF7 and shifts a column
    // back; loops on with no row-boundary check.
    const t = (mem8[SEG_TILE] - 1) & 0xff;
    mem8[SEG_TILE] = t;
    if (((t - 0xf0) & 0x80) !== 0) {
      hl = u16(hl - 1);
      mem8[SEG_TILE] = 0xf7;
    }
    phase = "STAMP_ROW";
  }

  regs.de = u16(regs.de + 1);
}
