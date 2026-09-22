// SPDX-License-Identifier: GPL-3.0-only
/**
 * nextAnimationStep — pure bit-field lookup over a packed byte C of four 2-bit fields, keyed by
 * input byte `a` (bit 0 picks family {0x90,0x6c} vs {0xb4,0x1e}, bit 2 picks within it) and a 2-bit
 * selector `b` (decremented first, on the bit-0-set family, when its bit 2 is set). Rotates C right
 * two bits until the low two match, exits on the field AFTER the match: CARRY set unless it is 3, in
 * which case bit 2 of the input is cleared and it decrements (3 while nonzero, else 0x04, CARRY clear).
 * ⚠ FAITHFUL NON-TERMINATION: no field can equal the selector (>3, or ==3 with C==0x90) → spins
 * forever as the hardware does; a guard would silently turn the hang into a wrong result.
 * LIVE-OUT: the result byte; carry and residual registers are reproduced for fidelity, not liveness.
 */
export function nextAnimationStep(a, b) {
  const ror2 = (v) => ((v >> 2) | (v << 6)) & 0xff;

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
 * (a, b) inputs and replays its register return. ⚠ Wired DIRECTLY (machine as the byte arg,
 * selector undefined) the scan loop's match never fires and it hangs — the marshalling is
 * load-bearing. Each branch's outputs ride a return-assignment. The terminal compare and the
 * deep-exit decrement set only F, which no caller reads (dead flag): the compare is dropped, and
 * the decrement becomes a plain byte op that preserves D exactly.
 */
export function nextAnimationStepFromRegisters(m, input = m.regs.a, bIn = m.regs.b) {
  const r = nextAnimationStep(input, bIn);

  if (r.carry) {
    return [m.regs.b = r.b, m.regs.c = r.c, m.regs.d = input, m.regs.a = r.a];
  }

  // next == 3: `res 2,d` (input & ~0x04) then `dec d` — a plain byte decrement; its flags were dead.
  const dVal = ((input & ~0x04) - 1) & 0xff;
  return [m.regs.b = r.b, m.regs.c = r.c, m.regs.d = dVal, m.regs.a = r.a];
}
