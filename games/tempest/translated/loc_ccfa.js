// SPDX-License-Identifier: GPL-3.0-only
// loc_ccfa  (ROM 0xccfa-0xccfd) -- trampoline entry: loads A=0xaf then (BNE always taken, A nonzero) tail-jumps
//   to loc_ccc7. The bytes ccfe/cd02/cd06 in this disasm block are THREE separate trampoline entry points
//   (lda #0xbf/#0x3f/#0xcf -> loc_ccc3), not reachable from ccfa -- see needs_attention.
export function loc_ccfa(m) {
  const { regs } = m;
  regs.a = 0xaf; regs.setNZ(regs.a); m.step(0xccfc, 2);
  m.step(0xccc7, 3); return m.call(0xccc7);
}
