// SPDX-License-Identifier: GPL-3.0-only

// loc_1518  (ROM 0x1518-0x1556) -- per-frame object update with a phase-advance step. First runs a
// shared per-frame routine (call 0x4006), then decrements the object's frame timer (ix+0x11); while
// it is still nonzero it returns early (ret nz -- most frames end here). When the timer expires it
// reads a table selector (0x8f60), doubled (sla a) into B; if that is zero it skips the sub-update
// (jr z,0x153a). Otherwise call 0x1131 (returns an index in A), stash it in E, and if C is nonzero
// store C at 0x85e9, then (loc_1533) set HL=0x85c9, A=E and call 0x1119. At loc_153a the object's
// phase (ix+0x16) is checked: phase 7 tail-jumps to 0x3d99 (done). Otherwise it advances -- inc A,
// write the new phase to (ix+0x13), reload the frame timer (ix+0x11)=1, bump (ix+0x02) -- then falls
// through into loc_154d, which re-runs 0x4006, decrements the just-reloaded timer (nonzero -> ret nz),
// and tail-jumps to 0x3553. loc_1533 and loc_154d are internal fall-through targets (no separate
// registered entry); their tails ret/jp in this routine's frame.
export function loc_1518(m) {
  const { regs, mem } = m;

  m.push16(0x151b);
  m.step(0x4006, 17); // 1518  call 0x4006 -- shared per-frame pre-step
  m.call(0x4006, "loc_4006: shared per-frame object pre-step");

  regs.decMem8(mem, (regs.ix + 0x11) & 0xffff);
  m.step(0x151e, 23); // 151b  dec (ix+0x11) -- frame timer

  if (regs.fNZ) { return m.ret(11); } // 151e  ret nz -- timer still running, most frames end here
  m.step(0x151f, 5);

  regs.a = mem.read8(0x8f60);
  m.step(0x1522, 13);
  regs.a = regs.sla(regs.a);
  m.step(0x1524, 8);
  regs.b = regs.a;
  m.step(0x1525, 4);
  regs.and(regs.a);
  m.step(0x1526, 4);

  if (regs.fZ) {
    m.step(0x153a, 12); // 1526  jr z,0x153a (taken) -- selector zero, skip sub-update
  } else {
    m.step(0x1528, 7);
    m.push16(0x152b);
    m.step(0x1131, 17); // 1528  call 0x1131 -- returns a table index in A
    m.call(0x1131, "loc_1131: resolve sub-update table index");
    regs.e = regs.a;
    m.step(0x152c, 4);
    regs.a = regs.c;
    m.step(0x152d, 4);
    regs.and(regs.a);
    m.step(0x152e, 4);

    if (regs.fZ) {
      m.step(0x1533, 12); // 152e  jr z,0x1533 (taken) -- C == 0, skip the store
    } else {
      m.step(0x1530, 7);
      mem.write8(0x85e9, regs.a);
      m.step(0x1533, 13);
    }

    // loc_1533:
    regs.hl = 0x85c9;
    m.step(0x1536, 10);
    regs.a = regs.e;
    m.step(0x1537, 4);
    m.push16(0x153a);
    m.step(0x1119, 17);
    m.call(0x1119, "loc_1119: sub-update at HL=0x85c9 with index A");
  }

  // loc_153a:
  regs.a = mem.read8((regs.ix + 0x16) & 0xffff);
  m.step(0x153d, 19); // 153a  ld a,(ix+0x16) -- current phase
  regs.cp(0x07);
  m.step(0x153f, 7);

  if (regs.fZ) {
    m.step(0x3d99, 10); // 153f  jp z,0x3d99 (taken) -- final phase: tail to done handler
    return m.call(0x3d99, "loc_3d99: object reached final phase");
  }
  m.step(0x1542, 10);

  regs.a = regs.inc8(regs.a);
  m.step(0x1543, 4); // 1542  inc a -- advance phase
  mem.write8((regs.ix + 0x13) & 0xffff, regs.a);
  m.step(0x1546, 19);
  mem.write8((regs.ix + 0x11) & 0xffff, 0x01);
  m.step(0x154a, 19); // 1546  ld (ix+0x11),0x01 -- reload frame timer
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff);
  m.step(0x154d, 23);

  // loc_154d:
  m.push16(0x1550);
  m.step(0x4006, 17); // 154d  call 0x4006 -- shared per-frame pre-step again
  m.call(0x4006, "loc_4006: shared per-frame object pre-step");
  regs.decMem8(mem, (regs.ix + 0x11) & 0xffff);
  m.step(0x1553, 23);

  if (regs.fNZ) { return m.ret(11); } // 1553  ret nz -- reloaded timer (1) -> 0, so normally falls through
  m.step(0x1554, 5);

  m.step(0x3553, 10); // 1554  jp 0x3553 -- tail (its ret is ours)
  return m.call(0x3553, "loc_3553: object phase-advance tail");
}
