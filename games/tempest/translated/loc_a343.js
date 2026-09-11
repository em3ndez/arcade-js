// SPDX-License-Identifier: GPL-3.0-only
// loc_a343 (ROM 0xa343-0xa34a) -- two demo entries that seed A with a per-entry tag then jmp into
// loc_a34d (the shared $013b-seed body in loc_a34b.js): 0xa343 lda #$09, 0xa347 lda #$07. The bne at
// 0xa345/0xa349 is unconditional (A is 9/7, never zero), taken same-page = 3 cycles.
export function loc_a343(m) {
  const { regs } = m;
  regs.a = 0x09; regs.setNZ(regs.a); m.step(0xa345, 2);
  m.step(0xa34d, 3); return m.call(0xa34d);
}

export function loc_a347(m) {
  const { regs } = m;
  regs.a = 0x07; regs.setNZ(regs.a); m.step(0xa349, 2);
  m.step(0xa34d, 3); return m.call(0xa34d);
}
