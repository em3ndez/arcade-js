// SPDX-License-Identifier: GPL-3.0-only
/**
 * addStrided — add a signed byte (regs.c, commonly -4) into each of regs.b bytes
 * spaced regs.de apart from regs.hl. Each add is 8-bit and wraps. do-while: the
 * count is tested after a pass, so 0 on entry runs 256 passes, not none.
 *
 * LIVE-OUT: the run of bytes (each raised by the addend, 8-bit wrap), plus A = the
 * last byte written, B = 0, and HL = the pointer past the last target (16-bit wrap).
 */
export function addStrided(m) {
  const { regs, mem8 } = m;

  const addend = regs.c;
  const stride = regs.de;
  const count = regs.b === 0 ? 256 : regs.b;

  let ptr = regs.hl;
  let a = 0;
  for (let i = 0; i < count; i++) {
    a = (addend + mem8[ptr]) & 0xff;
    mem8[ptr] = a;
    ptr = (ptr + stride) & 0xffff;
  }

  regs.a = a;
  regs.hl = ptr;
  regs.b = 0;
}
