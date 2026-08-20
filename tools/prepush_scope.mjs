// SPDX-License-Identifier: GPL-3.0-only
// Decide the pre-push test scope from the pushed commits' changed-file list (read on stdin, one path
// per line). Prints "FULL" or "SUBSET <game>". FAILS SAFE to FULL: a push is narrowed to one game
// ONLY when every changed path is under that single games/<g>/ dir. Any shared path (core, boards,
// tools, web, hooks, a root file) or a second game -> FULL; empty/unknown input -> FULL. This is
// safe because games are independent (no game imports another), and the FULL-fallback keeps every
// shared test (core/boards/tools/web) running for anything that could affect more than one game --
// the subset the hook builds also keeps all shared tests and only skips the OTHER games.
import { createInterface } from "node:readline";

export function classify(files) {
  if (files.length === 0) return "FULL";
  let game = null;
  for (const f of files) {
    if (f === "__FULL__") return "FULL"; // sentinel the hook emits when the range is unknowable
    const m = /^games\/([^/]+)\//.exec(f);
    if (!m) return "FULL"; // any non-game path is shared -> full
    if (game === null) game = m[1];
    else if (game !== m[1]) return "FULL"; // a second game -> full
  }
  return `SUBSET ${game}`;
}

const SELFTEST_CASES = [
  [[], "FULL"],
  [["games/pooyan/translated/loc_056b.js"], "SUBSET pooyan"],
  [["games/pooyan/a.js", "games/pooyan/test/b.test.js"], "SUBSET pooyan"],
  [["games/pooyan/a.js", "games/dkong/b.js"], "FULL"],
  [["games/pooyan/a.js", "tools/x.py"], "FULL"],
  [["core/cpu/z80.js"], "FULL"],
  [["boards/pooyan/video.js"], "FULL"],
  [["hooks/pre-push"], "FULL"],
  [["README.md"], "FULL"],
  [["__FULL__"], "FULL"],
  [["games/pooyan/a.js", "__FULL__"], "FULL"],
];

if (process.argv[2] === "--selftest") {
  let ok = true;
  for (const [inp, want] of SELFTEST_CASES) {
    const got = classify(inp);
    if (got !== want) {
      console.error(`FAIL: ${JSON.stringify(inp)} -> ${got}, want ${want}`);
      ok = false;
    }
  }
  console.log(ok ? "prepush_scope selftest: OK" : "prepush_scope selftest: FAILED");
  process.exit(ok ? 0 : 1);
} else {
  const files = [];
  const rl = createInterface({ input: process.stdin });
  rl.on("line", (l) => {
    const t = l.trim();
    if (t) files.push(t);
  });
  rl.on("close", () => console.log(classify(files)));
}
