// SPDX-License-Identifier: GPL-3.0-only
/**
 * serviceVblankNmi — memory-equivalent to the frozen oracle at ROM 0x0066 (the vblank NMI handler).
 * GATE: crafted-entry. WIRED: the engine's NMI fire is `this.call(0x0066)`, which runs this idiomatic
 * override (it seats through withOmittedRet — the JS handler leaves SP balanced; the raw `retn` is the
 * oracle's form). This gate documents the handler and pins the dissolutions. The
 * handler acks the NMI, scans coins, blits the sprite shadow into OBJRAM with the nibble-swap, ticks the
 * coin timers, then dispatches on the play/mode flags. A post-attract seed is cloned, SP seated at 0x8800,
 * and cells poked to drive: attract (mode 0), attract mode>=2, in-play minimal (frog-freeze countdown), and
 * the full in-play frame. RAM compared, stack masked. Teeth: no-op, a blit-byte twin, a clear-cell twin.
 * Positive control: the attract clear zeroes a seeded cell and the sprite blit copies 0x8007->0xb007.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, STUBS } from "./_bootSetup.js";
import { serviceVblankNmi as cand } from "../serviceVblankNmi.js";
import { loc_0066 as oracle } from "../../translated/loc_0066.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const CLEAR_CELL = 0x8260, BLIT_SRC = 0x8007, BLIT_DST = 0xb007;

const attract = () => craft();
const attractHigh = () => craft((mem) => { mem[0x83d6] = 3; mem[0x83d8] = 1; mem[0x83d7] = 0; });
const inPlayMin = () => craft((mem) => { mem[0x83fe] = 1; mem[0x83ea] = 1; mem[0x83d2] = 1; mem[0x83d3] = 0; mem[0x80ff] = 0; });
const inPlayFull = () => craft((mem) => { mem[0x83fe] = 1; mem[0x83ea] = 1; mem[0x83d2] = 0; mem[0x83d3] = 0; mem[0x83fd] = 1; mem[0x825c] = 0; mem[0x80ff] = 0; });

test("EQUAL (crafted): serviceVblankNmi == oracle across the dispatch tree", { skip }, () => {
  for (const [name, mk] of [["attract", attract], ["attract-mode>=2", attractHigh], ["in-play-min", inPlayMin], ["in-play-full", inPlayFull]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} path diverged`);
  }
  const e = craft((mem) => { mem[CLEAR_CELL] = 0x55; mem[BLIT_SRC] = 0x9a; mem[BLIT_DST] = 0x00; });
  const a = e.clone(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[CLEAR_CELL], 0, "positive control: attract clears the seeded cell 0x55->0");
  assert.equal(a.mem8[BLIT_DST], 0x9a, "positive control: the sprite blit copies 0x8007->0xb007");
  console.log("  EQUAL: attract/attract-mode>=2/in-play-min/in-play-full; control 0x8260 0x55->0, blit ->0x9a");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const blitTwin = (m) => { cand(m); m.mem8[BLIT_DST] = (m.mem8[BLIT_DST] + 1) & 0xff; };
  const clearTwin = (m) => { cand(m); m.mem8[CLEAR_CELL] = 0xff; };
  assert.ok(ramDiff(oracle, noOp, attract()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, blitTwin, attract()), "blit-byte twin escaped");
  assert.ok(ramDiff(oracle, clearTwin, craft((mem) => { mem[CLEAR_CELL] = 0x55; })), "clear-cell twin escaped");
  console.log("  TEETH: no-op, blit-byte, clear-cell all caught");
});
