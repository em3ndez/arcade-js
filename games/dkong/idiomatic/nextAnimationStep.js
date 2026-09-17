// SPDX-License-Identifier: GPL-3.0-only
/**
 * nextAnimationStep — pure bit-field lookup over a packed byte C of four 2-bit fields, keyed by
 * input byte `a` (bit 0 picks a family {0x90,0x6c} vs {0xb4,0x1e}, bit 2 picks within it) and a
 * 2-bit selector `b` (decremented first, on the bit-0-set family, when its bit 2 is set). Scans C's
 * fields by rotating right two bits until the low two match, then exits on the field AFTER the match:
 * that value returns with CARRY set unless it is 3, in which case bit 2 of the original input is
 * cleared and it is decremented (return 3 while nonzero, else 0x04, CARRY clear).
 * ⚠ FAITHFUL NON-TERMINATION: when no field can equal the effective selector (>3, or ==3 with
 * C==0x90 which has no 3) the loop spins forever, exactly as the hardware does — a guard would
 * silently turn the hang into a wrong terminating result, so none is added.
 * LIVE-OUT: the result byte; the carry and residual registers are reproduced for fidelity, not
 * as liveness claims.
 */
export function nextAnimationStep(a, b) {
  const ror2 = (v) => ((v >> 2) | (v << 6)) & 0xff; // 8-bit rotate right by two bits

  const d = a; // original input, saved for the exit test
  let bEff = b;
  let c;

  if ((a & 0x01) === 0) {
    c = (a & 0x04) ? 0x6c : 0x90;
  } else {
    c = (a & 0x04) ? 0x1e : 0xb4;
    if (b & 0x04) bEff = (b - 1) & 0xff; // only this family decrements the selector
  }

  for (;;) { // spins forever if no field of C can equal bEff — faithful to the hardware
    c = ror2(c);
    if ((c & 0x03) === bEff) break;
  }

  const next = ror2(c) & 0x03; // the field AFTER the match decides the exit
  if (next !== 3) {
    return { a: next, carry: true, b: bEff, c, d };
  }

  const d2 = ((d & ~0x04) - 1) & 0xff;
  if (d2 !== 0) return { a: 3, carry: false, b: bEff, c, d: d2 };
  return { a: 0x04, carry: false, b: bEff, c, d: d2 };
}

/**
 * nextAnimationStepFromRegisters — the seam entry: marshals the machine to the pure function's
 * (a, b) inputs and replays its register/flag return. ⚠ Wired DIRECTLY (machine as the byte arg,
 * selector undefined) the scan loop's match never fires and it hangs — the marshalling is
 * load-bearing. Flags are rebuilt by replaying the terminal compare + decrement, not assembled.
 */
export function nextAnimationStepFromRegisters(m, input = m.regs.a, bIn = m.regs.b) {
  const { regs } = m;
  const r = nextAnimationStep(input, bIn);

  regs.b = r.b;
  regs.c = r.c;
  regs.d = input;

  regs.a = r.carry ? r.a : 0x03;
  regs.cp(0x03); // replays the terminal compare (fidelity, not a consumer)
  if (!r.carry) {
    // next == 3: the two-stage exit clears bit 2 of the saved input and decrements it
    regs.d = regs.res(2, regs.d);
    regs.d = regs.dec8(regs.d);
    regs.a = r.a;
  }
}
