// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1cdc — crafted-entry equivalence vs the frozen descriptor-unpack-and-draw at ROM 0x1cdc.
 * It reads a fixed descriptor at HL — a source word, a destination word, then a count byte — and paints
 * that many characters up a tilemap column (each source byte mapped by -'0'), the loop dissolved to the
 * decompiled column draw. The only live-out is the destination column in VIDEO RAM, so ramDiff alone
 * suffices; the stack window is masked. Teeth: no-op, a no-subtract twin (skips the '0' offset), and a
 * stride-1 twin (walks across a row, not up a column).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { drawTextColumnFromDescriptor as cand } from "../drawTextColumnFromDescriptor.js";
import { loc_1cdc as oracle } from "../../translated/loc_1cdc.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const RECORD = 0x4300; // descriptor in work RAM, clear of the masked stack window
const SRC = 0x1d71;    // ROM source bytes (deterministic)
const DEST = 0x5140;   // VRAM column cell the run starts at
const COUNT = 8;
const STRIDE = 0xffe0; // -0x20: one tilemap row up per character
const CHAR_ZERO = 48;
const SENTINEL = 0xee;

// Lay the descriptor (source word, dest word, count byte), seat HL/B as the ROM entry does, sentinel the
// destination column, and push the return address the dissolved draw loop's ret consumes.
const entry = () => craft((mem, m) => {
  mem[RECORD] = SRC & 0xff; mem[RECORD + 1] = (SRC >> 8) & 0xff;
  mem[RECORD + 2] = DEST & 0xff; mem[RECORD + 3] = (DEST >> 8) & 0xff;
  mem[RECORD + 4] = COUNT;
  m.regs.hl = RECORD;
  m.regs.b = 2;
  for (let k = 0; k < COUNT; k++) mem[(DEST + k * STRIDE) & 0xffff] = SENTINEL;
  m.push16(0x9999);
});

test("EQUAL (crafted): loc_1cdc == oracle unpacks and draws the column", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, entry()), null, "loc_1cdc diverged");
  // positive control: each character is (source byte - '0') and lands one row up from the last.
  const a = entry(); oracle(a);
  assert.equal(a.mem8[DEST], (a.mem8[SRC] - CHAR_ZERO) & 0xff, "control: char 0 at the column start");
  assert.equal(a.mem8[(DEST + STRIDE) & 0xffff], (a.mem8[SRC + 1] - CHAR_ZERO) & 0xff, "control: char 1 one row up");
  assert.notEqual(a.mem8[DEST], SENTINEL, "control: oracle overwrote the sentinel");
  console.log("  EQUAL: loc_1cdc == oracle (RAM), 8-char column drawn from the descriptor");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  // Stores the raw source byte without the '0' offset -> wrong tile codes.
  const noSub = (m) => { const { mem8 } = m; let rd = SRC, wr = DEST; for (let i = 0; i < COUNT; i++) { mem8[wr] = mem8[rd]; rd += 1; wr += STRIDE; } };
  // Walks the destination by 1 (across a row) instead of by the stride (up a column) -> wrong cells.
  const stride1 = (m) => { const { mem8 } = m; let rd = SRC, wr = DEST; for (let i = 0; i < COUNT; i++) { mem8[wr] = mem8[rd] - CHAR_ZERO; rd += 1; wr += 1; } };
  assert.ok(ramDiff(oracle, noOp, entry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, noSub, entry()), "the no-subtract twin escaped");
  assert.ok(ramDiff(oracle, stride1, entry()), "the stride-1 twin escaped");
  console.log("  TEETH: no-op, no-subtract, stride-1 all caught");
});
