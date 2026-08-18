// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectDiveVariantFrame — memory-equivalent to the frozen oracle at ROM 0x286D: point the dive frame
 * copy at the ALTERNATE table 0x1403 and hand off to copyDiveAnimFrame. GATE: crafted-entry. Branches:
 * non-reset and reset (inherited from the copy). Entry HL is deliberately bogus to prove the table base
 * is fixed at 0x1403 (not the live-in). RAM compared, stack masked. Teeth: no-op and a wrong-table twin
 * (main table 0x1413); positive control asserts the VRAM byte comes from ROM 0x1403.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, STUBS } from "./_bootSetup.js";
import { selectDiveVariantFrame as cand } from "../selectDiveVariantFrame.js";
import { copyDiveAnimFrame } from "../copyDiveAnimFrame.js";
import { loc_286d as oracle } from "../../translated/loc_287e.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const FRAME_IDX = 0x814e, COLUMN = 0x8145, BUSY = 0x814f, C6 = 0x8146, C7 = 0x8147;
const VRAM = 0xa806, MAIN_TABLE = 0x1413;

// DE = 0xa806 is the VRAM base the real caller (loc_27fe) hands the copy; loc_286d preserves it. Entry HL
// is bogus on purpose: loc_286d overwrites it with 0x1403.
const nonReset = () => craft((mem, m) => { mem[FRAME_IDX] = 0; mem[COLUMN] = 0; mem[VRAM] = 0; mem[VRAM + 1] = 0; m.regs.de = VRAM; m.regs.hl = 0x0000; });
const reset = () => craft((mem, m) => { mem[FRAME_IDX] = 0x0e; mem[COLUMN] = 0xa0; mem[BUSY] = 0xaa; mem[C6] = 0xbb; mem[C7] = 0xcc; m.regs.de = VRAM; m.regs.hl = 0x0000; });

test("EQUAL (crafted): selectDiveVariantFrame == oracle on non-reset/reset", { skip }, () => {
  for (const [name, mk] of [["non-reset", nonReset], ["reset", reset]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} path diverged`);
  }
  const a = nonReset(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[VRAM], 0x5c, "control: alt-table VRAM byte0 <- ROM 0x1403 (ignores entry HL=0)");
  assert.equal(a.mem8[FRAME_IDX], 2, "control: frame index stepped +2");
  console.log("  EQUAL: non-reset/reset; control VRAM<-ROM 0x1403 despite bogus entry HL");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongTable = (m) => copyDiveAnimFrame(m, MAIN_TABLE); // 0x1413 -> byte 0x10, not 0x5c
  assert.ok(ramDiff(oracle, noOp, nonReset()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongTable, nonReset()), "wrong-table twin escaped");
  console.log("  TEETH: no-op, wrong-table (0x1413) both caught");
});
