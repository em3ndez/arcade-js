// SPDX-License-Identifier: GPL-3.0-only
/**
 * copyDiveAnimFrame — memory-equivalent to the frozen oracle at ROM 0x281B. Copies one two-byte dive
 * frame from a ROM table (base = live-in HL) into a VRAM column, advances the frame index (+2) and the
 * column (+0x20), and on the final frame (index reaches 0x10) clears the busy latch and all frame cells.
 * GATE: crafted-entry (attract never dives). A post-attract clone is poked with a frame index / column /
 * table base, VRAM dest cleared. Branches: non-reset (index 0), reset (index 0x0e -> 0x10), and the
 * alternate table (HL=0x1403). RAM compared, stack masked. Teeth: no-op, a VRAM-byte twin, an index twin;
 * positive controls assert the VRAM write lands and the reset zeroes the seeded cells.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, STUBS } from "./_bootSetup.js";
import { copyDiveAnimFrame as cand } from "../copyDiveAnimFrame.js";
import { loc_281b as oracle } from "../../translated/loc_27ea.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const FRAME_IDX = 0x814e, COLUMN = 0x8145, BUSY = 0x814f, C6 = 0x8146, C7 = 0x8147;
const VRAM = 0xa806;
const MAIN_TABLE = 0x1413, ALT_TABLE = 0x1403;

// DE = 0xa806 is the VRAM base the real caller (loc_27fe) hands loc_281b; set it for the isolated oracle.
const nonReset = () => craft((mem, m) => { mem[FRAME_IDX] = 0; mem[COLUMN] = 0; mem[BUSY] = 0xaa; mem[C6] = 0xbb; mem[C7] = 0xcc; mem[VRAM] = 0; mem[VRAM + 1] = 0; m.regs.de = VRAM; m.regs.hl = MAIN_TABLE; });
const reset = () => craft((mem, m) => { mem[FRAME_IDX] = 0x0e; mem[COLUMN] = 0xa0; mem[BUSY] = 0xaa; mem[C6] = 0xbb; mem[C7] = 0xcc; m.regs.de = VRAM; m.regs.hl = MAIN_TABLE; });
const altTable = () => craft((mem, m) => { mem[FRAME_IDX] = 0; mem[COLUMN] = 0; mem[VRAM] = 0; mem[VRAM + 1] = 0; m.regs.de = VRAM; m.regs.hl = ALT_TABLE; });

test("EQUAL (crafted): copyDiveAnimFrame == oracle across reset/non-reset/alt-table", { skip }, () => {
  for (const [name, mk] of [["non-reset", nonReset], ["reset", reset], ["alt-table", altTable]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} path diverged`);
  }
  // positive control: non-reset copies ROM[0x1413]=0x10 into VRAM and steps index/column, no reset.
  let a = nonReset(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[VRAM], 0x10, "control: VRAM byte0 <- ROM 0x1413");
  assert.equal(a.mem8[VRAM + 1], 0x10, "control: VRAM byte1 <- ROM 0x1414");
  assert.equal(a.mem8[FRAME_IDX], 2, "control: frame index stepped +2");
  assert.equal(a.mem8[COLUMN], 0x20, "control: column stepped +0x20");
  assert.equal(a.mem8[BUSY], 0xaa, "control: busy latch untouched on non-reset");
  // positive control: reset (index 0x0e -> 0x10) zeroes the busy latch and every frame cell.
  a = reset(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[BUSY], 0, "control: reset clears busy latch");
  assert.equal(a.mem8[FRAME_IDX], 0, "control: reset clears frame index");
  assert.equal(a.mem8[COLUMN], 0, "control: reset clears column");
  assert.equal(a.mem8[C6], 0, "control: reset clears cell 0x8146");
  assert.equal(a.mem8[C7], 0, "control: reset clears cell 0x8147");
  // positive control: alternate table copies ROM[0x1403]=0x5c.
  a = altTable(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[VRAM], 0x5c, "control: alt-table VRAM byte0 <- ROM 0x1403");
  console.log("  EQUAL: non-reset/reset/alt-table; controls VRAM<-ROM, +2/+0x20 step, reset zeroes cells");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const vramTwin = (m) => { cand(m); m.mem8[VRAM + 1] = (m.mem8[VRAM + 1] + 1) & 0xff; };
  const idxTwin = (m) => { cand(m); m.mem8[FRAME_IDX] = (m.mem8[FRAME_IDX] + 1) & 0xff; };
  assert.ok(ramDiff(oracle, noOp, nonReset()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, vramTwin, nonReset()), "vram-byte twin escaped");
  assert.ok(ramDiff(oracle, idxTwin, nonReset()), "frame-index twin escaped");
  console.log("  TEETH: no-op, vram-byte, frame-index all caught");
});
