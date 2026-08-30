// SPDX-License-Identifier: GPL-3.0-only

// loc_13fe  (ROM 0x13fe-0x140f) -- advance the object's X position (ix+0x05) by its per-frame
// velocity (ix+0x0a), decrementing a lifetime/lap counter (ix+0x06) when the object wraps.
// B = -(ix+0x0a) (negated velocity). If the current X (ix+0x05) is below that threshold
// (cp b sets carry), it has crossed zero -> dec (ix+0x06). At loc_140d the raw velocity
// (ix+0x0a) is re-added to A, then the routine falls through into loc_1410 (its own entry,
// which stores A back into (ix+0x05) and continues). loc_140d is an internal jr target (no
// registered entry); loc_1410 is the separate next routine.
export function loc_13fe(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x0a) & 0xffff);
  m.step(0x1401, 19); // 13fe  ld a,(ix+0x0a)
  regs.neg();
  m.step(0x1403, 8); // 1401  neg
  regs.b = regs.a;
  m.step(0x1404, 4); // 1403  ld b,a
  regs.a = mem.read8((regs.ix + 0x05) & 0xffff);
  m.step(0x1407, 19); // 1404  ld a,(ix+0x05)
  regs.cp(regs.b);
  m.step(0x1408, 4); // 1407  cp b

  if (regs.fNC) {
    m.step(0x140d, 12); // 1408  jr nc,0x140d (taken) -- X >= threshold, no wrap
  } else {
    m.step(0x140a, 7); // 1408  jr nc (not taken)
    regs.decMem8(mem, (regs.ix + 0x06) & 0xffff);
    m.step(0x140d, 23); // 140a  dec (ix+0x06) -- wrapped: consume a lifetime/lap
  }

  // loc_140d:
  regs.add(mem.read8((regs.ix + 0x0a) & 0xffff));
  m.step(0x1410, 19); // 140d  add a,(ix+0x0a)

  // fall through into loc_1410 (separate registered routine; its ret returns to our caller)
  return m.call(0x1410, "loc_1410: store advanced X into (ix+0x05) and continue");
}
