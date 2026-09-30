// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1b5d (blankVideoRam) -- equivalence vs the frozen translated oracle. This one is a real call/ret
 * subroutine, so the candidate runs through the game's withOmittedRet seam (as the live registry installs it)
 * and SP and pc are compared too: both must come back on the caller's return slot. Entries: the one captured
 * dispatch (from the checksum stage, return address already pushed) and a crafted warm entry with a pushed
 * return. Teeth: wrong fill tile (ram), no watchdog kicks (io), and a twin that skips the ret (SP).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { captures, diff, run, warmEntry, romsPresent } from "./_coldBoot.js";
import { blankVideoRam } from "../blankVideoRam.js";
import { withOmittedRet } from "../../machine.js";
import { loc_1b5d as oracle } from "../../translated/loc_1b5d.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const cand = withOmittedRet(blankVideoRam, 0x1b5d);

function compare(o, c, entry) {
  const a = run(o, entry), b = run(c, entry);
  const d = diff(a, b);
  if (d) return d;
  if (a.m.regs.sp !== b.m.regs.sp) return `sp ${a.m.regs.sp} vs ${b.m.regs.sp}`;
  if (a.m.pc !== b.m.pc) return `pc ${a.m.pc} vs ${b.m.pc}`;
  return null;
}

test("EQUAL (captured dispatch, through the seam)", { skip }, () => {
  const entries = captures()[0x1b5d];
  assert.equal(entries.length, 1, "positive control: the boot calls the screen blank once");
  assert.equal(compare(oracle, cand, entries[0]), null);
  assert.equal(run(oracle, entries[0]).m.pc, 0x1b73, "the oracle returns to the checksum stage's slot");
});

test("EQUAL (crafted warm entry with a pushed return)", { skip }, () => {
  const e = warmEntry(captures()[0x0000][0], (m) => m.push16(0x9999));
  assert.equal(compare(oracle, cand, e), null);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = warmEntry(captures()[0x0000][0], (m) => m.push16(0x9999));
  const tileZero = withOmittedRet((m) => { for (let i = 0; i < 0x400; i++) m.mem8[0x5000 + i] = 0; for (let p = 0; p < 4; p++) void m.mem8[0x7800]; });
  const noKicks = withOmittedRet((m) => { for (let i = 0; i < 0x400; i++) m.mem8[0x5000 + i] = 16; });
  const noRet = blankVideoRam; // raw, outside the seam: never pops the caller's slot
  assert.ok(compare(oracle, tileZero, e), "tile-0 twin escaped (ram)");
  assert.ok(compare(oracle, noKicks, e), "no-kick twin escaped (watchdog)");
  assert.ok(compare(oracle, noRet, e), "no-ret twin escaped (sp/pc)");
});
