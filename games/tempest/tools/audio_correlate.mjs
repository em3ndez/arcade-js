// SPDX-License-Identifier: GPL-3.0-only
// §5 audio oracle (node): replay a timestamped POKEY write stream into games/tempest/audio/synth.js at the
// reference WAV's sample rate and compare to MAME's -wavwrite output on the runbook's two falsifiable tests:
// (i) per-context AC (DC-removed) LEVEL match and (ii) the AC-envelope CORRELATION being clearly positive.
// Inputs are captured by games/tempest/tools/audio_suite.py (MAME + games/tempest/tools/lua/audio_tape.lua).
// Usage: node audio_correlate.mjs <out.wav> <pokey_writes.txt>  -- prints the numbers; exit 0 iff both pass.
import { readFileSync } from "node:fs";
import { Synth, POKEY1_BASE } from "../audio/synth.js";

const CORR_MIN = 0.5;               // "clearly positive" -- the falsifiable tracks-the-original bar (§5)
const RATIO_LO = 0.5, RATIO_HI = 2; // AC level within a factor of 2 of MAME (calibrated gain, §5)

function readWav(path) {
  const b = readFileSync(path);
  let off = 12, rate = 48000, dataOff = 44, dataLen = b.length - 44;
  while (off + 8 <= b.length) {
    const id = b.toString("ascii", off, off + 4), sz = b.readUInt32LE(off + 4);
    if (id === "fmt ") rate = b.readUInt32LE(off + 12);
    if (id === "data") { dataOff = off + 8; dataLen = sz; break; }
    off += 8 + sz + (sz & 1);
  }
  const n = dataLen >> 1, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = b.readInt16LE(dataOff + i * 2) / 32768;
  return { out, rate };
}

const [wavPath, writesPath] = process.argv.slice(2);
if (!wavPath || !writesPath) { console.error("usage: node audio_correlate.mjs <out.wav> <pokey_writes.txt>"); process.exit(2); }

const { out: mame, rate } = readWav(wavPath);
const N = mame.length;
const writes = readFileSync(writesPath, "utf8").trim().split("\n").map((l) => {
  const [t, chip, reg, val] = l.split(" ");
  return { s: Math.floor(parseFloat(t) * rate), addr: POKEY1_BASE + (+chip) * 0x10 + (+reg), val: +val };
});

// Replay the write stream into the synth, segment-by-segment between writes.
const synth = new Synth(rate), port = new Float32Array(N);
let wi = 0, pos = 0;
while (pos < N) {
  while (wi < writes.length && writes[wi].s <= pos) { synth.write(writes[wi].addr, writes[wi].val); wi++; }
  let next = wi < writes.length ? Math.min(N, writes[wi].s) : N;
  if (next <= pos) next = pos + 1;
  synth.render(port.subarray(pos, Math.min(next, N)));
  pos = next;
}

// DC-remove (AC), then short-window RMS envelopes; the envelope Pearson correlation is the tracks-original test.
const ac = (a) => { let m = 0; for (const x of a) m += x; m /= a.length; const o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] - m; return o; };
const env = (a, w) => { const n = Math.floor(a.length / w), e = new Float64Array(n); for (let k = 0; k < n; k++) { let s = 0; for (let i = 0; i < w; i++) { const x = a[k * w + i]; s += x * x; } e[k] = Math.sqrt(s / w); } return e; };
const pearson = (x, y) => { const n = Math.min(x.length, y.length); let mx = 0, my = 0; for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; } mx /= n; my /= n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; } return sxy / Math.sqrt(sxx * syy); };
const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);

const mameAC = ac(mame), portAC = ac(port);
const win = Math.floor(rate * 0.01);
const corr = pearson(env(mameAC, win), env(portAC, win));
const ratio = rms(portAC) / rms(mameAC);

console.log(`samples ${N} @ ${rate}Hz (${(N / rate).toFixed(1)}s), writes ${writes.length}`);
console.log(`AC RMS  MAME=${rms(mameAC).toFixed(5)}  port=${rms(portAC).toFixed(5)}  ratio ${ratio.toFixed(3)}`);
console.log(`AC-envelope correlation ${corr.toFixed(4)}`);
const ok = corr >= CORR_MIN && ratio >= RATIO_LO && ratio <= RATIO_HI;
console.log(ok ? `tempest_audio: OK (corr>=${CORR_MIN}, ratio in [${RATIO_LO},${RATIO_HI}])`
               : `tempest_audio: FAIL (corr ${corr.toFixed(3)} / ratio ${ratio.toFixed(3)})`);
process.exit(ok ? 0 : 1);
