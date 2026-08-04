# SPDX-License-Identifier: GPL-3.0-only
"""
Emit games/dkong/contrib/computerarcheology/Code.md -- the Computer Archeology
main-CPU listing for Donkey Kong.

This is the DETERMINISTIC half of the page: addresses, opcode bytes, mnemonics,
labels and operand tags. Behaviour comments are added by a later pass and are
NOT produced here.

CLEAN-ROOM INPUT RULE (docs/contributing-disassembly.md). The only inputs are:

  games/dkong/out/dk.asm                        the raw disassembly (ROM facts)
  games/dkong/idiomatic/names.js                names registry: `export const`
                                                RAM cells + ROUTINES `name` only
                                                (never `why`, never `cert`)
  games/dkong/contrib/computerarcheology/Hardware.md   the hard memory table
  games/dkong/contrib/computerarcheology/RAMUse.md     the ram memory table
  games/dkong/manifest.js                       the ROM part list
  games/dkong/rom/maincpu.bin                   the ROM, for the round-trip check

`games/dkong/translated/` and every `games/dkong/idiomatic/*.js` other than
names.js are OFF LIMITS -- if the generator cannot see the port, port language
cannot leak into a public archive.

FORMAT is mirrored from the accepted submission
games/thepit/contrib/computerarcheology/Code.md, measured column by column:

  header directives outside the fence, the whole listing inside one ```code fence
  ADDR: BYTES  MNEMONIC operand  ; {tag} comment
  cols:  0-5    6-21    22-29    30-49    51-
  uppercase hex for addresses / bytes / operands, lowercase `loc_xxxx` labels
  data blocks:  `; ---- $AAAA-$BBBB: data ----` then 16 bytes per row
  a blank line before every label and around every data block

TAGGING follows The Pit's file exactly: only a direct memory operand `($nnnn)`
and a branch/call target take a tag. A 16-bit immediate (`LD HL,$6009`) does
NOT, because an immediate is not necessarily an address and telling a pointer
from a constant needs semantic judgement this pass must not invent.

Run:  python3 games/dkong/tools/ca_emit.py [--check]
      --check  verify only, do not write
"""

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
GAME = ROOT / "games" / "dkong"
CONTRIB = GAME / "contrib" / "computerarcheology"

ASM = GAME / "out" / "dk.asm"
NAMES = GAME / "idiomatic" / "names.js"
MANIFEST = GAME / "manifest.js"
HARDWARE = CONTRIB / "Hardware.md"
RAMUSE = CONTRIB / "RAMUse.md"
ROM = GAME / "rom" / "maincpu.bin"
OUT = CONTRIB / "Code.md"

ROM_SIZE = 0x4000

# Column geometry, measured off the accepted The Pit page.
BYTES_COL = 16
MNEM_COL = 8
OPND_COL = 20


# ---------------------------------------------------------------------------
# inputs
# ---------------------------------------------------------------------------

def read_asm():
    """Parse out/dk.asm into labels + address-ordered items.

    Item kinds:
      ('code', addr, bytes, mnemonic, operand)
      ('data', addr, bytes, kind)      kind in {'jump table', 'data'}
    """
    labels = {}
    items = []
    pending_data_kind = "data"

    for line in ASM.read_text().split("\n"):
        if not line.strip():
            continue

        m = re.match(r"^loc_([0-9a-f]{4}):$", line)
        if m:
            labels[int(m.group(1), 16)] = "loc_" + m.group(1)
            continue

        if re.match(r"^; ==== UNREACHED 0x[0-9a-f]{4}-0x[0-9a-f]{4} \(\d+ bytes\) ====$", line):
            pending_data_kind = "data"
            continue

        if re.match(r"^; ---- inline jump table 0x[0-9a-f]{4}-0x[0-9a-f]{4} ----$", line):
            pending_data_kind = "jump table"
            continue

        # `    ; 3fba:  defb 0x00,0x00,...`  -- a run of raw bytes
        m = re.match(r"^    ; ([0-9a-f]{4}):  defb (.*)$", line)
        if m:
            addr = int(m.group(1), 16)
            data = [int(b, 16) for b in re.findall(r"0x([0-9a-f]{2})", m.group(2))]
            items.append(("data", addr, data, pending_data_kind))
            continue

        # `    dw 0x01c3                   ; 00ca`  -- a jump-table word
        m = re.match(r"^    dw 0x([0-9a-f]{4})\s+; ([0-9a-f]{4})$", line)
        if m:
            word = int(m.group(1), 16)
            addr = int(m.group(2), 16)
            items.append(("data", addr, [word & 0xFF, word >> 8], pending_data_kind))
            continue

        # `    ld a,0x00                    ; 0000  3e 00`
        m = re.match(r"^    (.+?)\s{2,}; ([0-9a-f]{4})  ([0-9a-f ]+)$", line)
        if m:
            text = m.group(1)
            addr = int(m.group(2), 16)
            data = [int(b, 16) for b in m.group(3).split()]
            parts = text.split(" ", 1)
            items.append(("code", addr, data, parts[0], parts[1] if len(parts) > 1 else ""))
            pending_data_kind = "data"
            continue

        if line.startswith(";"):
            continue  # file banner

        raise SystemExit("ca_emit: unparsed dk.asm line: %r" % line)

    items.sort(key=lambda it: it[1])
    return labels, items


def read_routine_names():
    """ROUTINES entry addresses -> `name`. `why`/`cert` are never read."""
    src = NAMES.read_text()
    start = src.index("export const ROUTINES = {")
    body = src[start:]
    out = {}
    for m in re.finditer(r'^  0x([0-9a-fA-F]{4}): \{ name: "([^"]+)"', body, re.M):
        out[int(m.group(1), 16)] = m.group(2)
    if not out:
        raise SystemExit("ca_emit: no ROUTINES entries parsed")
    return out


def read_memory_table(path):
    """Parse a page's `>>> memory` table into [(lo, hi, name, direction)].

    direction is 'R', 'W' or None (both), taken from the description's own
    `R:` / `W:` prefix -- the same address can be two devices.
    """
    rows = []
    for line in path.read_text().split("\n"):
        m = re.match(r"^\| ([0-9a-f]{4})(?::([0-9a-f]{4}))? \| (\w+) \| (.*?) \|\s*$", line)
        if not m:
            continue
        lo = int(m.group(1), 16)
        hi = int(m.group(2), 16) if m.group(2) else lo
        desc = m.group(4)
        direction = None
        if re.match(r"^R\b", desc):
            direction = "R"
        elif re.match(r"^W\b", desc):
            direction = "W"
        rows.append((lo, hi, m.group(3), direction))
    if not rows:
        raise SystemExit("ca_emit: no memory rows parsed from %s" % path)
    return rows


def read_rom_parts():
    """The main-CPU ROM part filenames, in address order, from the manifest."""
    src = MANIFEST.read_text()
    m = re.search(r"maincpu:\s*\{\s*parts:\s*\[([^\]]*)\]", src)
    if not m:
        raise SystemExit("ca_emit: no maincpu parts in manifest.js")
    return re.findall(r'"([^"]+)"', m.group(1))


# ---------------------------------------------------------------------------
# operand tagging
# ---------------------------------------------------------------------------

class Tagger:
    def __init__(self, hard_rows, ram_rows, labels):
        self.hard = hard_rows
        self.ram = {lo: name for lo, hi, name, _ in ram_rows}
        self.labels = labels
        self.unresolved = []

    def memory(self, addr, direction):
        """Tag for a direct memory operand at `addr` ('R' read / 'W' write)."""
        if addr in self.ram:
            return "{ram.%s}" % self.ram[addr]
        best = None
        for lo, hi, name, d in self.hard:
            if not (lo <= addr <= hi):
                continue
            if d is not None and d != direction:
                continue
            # A single-address row beats a range row covering the same byte.
            score = (0 if hi == lo else 1, hi - lo)
            if best is None or score < best[0]:
                best = (score, name, lo)
        if best is None:
            return None
        _, name, lo = best
        return "{hard.%s}" % name if addr == lo else "{hard.%s+%X}" % (name, addr - lo)

    def code(self, addr):
        label = self.labels.get(addr)
        return "{code.%s}" % label if label else None


def tag_for(mnemonic, operand, tagger):
    """The one tag a listing line carries, or None."""
    if mnemonic == "ld":
        m = re.match(r"^\(0x([0-9a-f]{4})\),", operand)
        if m:
            return tagger.memory(int(m.group(1), 16), "W")
        m = re.search(r",\(0x([0-9a-f]{4})\)$", operand)
        if m:
            return tagger.memory(int(m.group(1), 16), "R")
        return None
    if mnemonic in ("jp", "jr", "call", "djnz"):
        m = re.search(r"0x([0-9a-f]{4})$", operand)
        if m:
            return tagger.code(int(m.group(1), 16))
    return None


def to_ca_syntax(text):
    """`ld a,(0x6007)` operand text -> The Pit's uppercase `$`-hex form."""
    return text.upper().replace("0X", "$")


# ---------------------------------------------------------------------------
# emission
# ---------------------------------------------------------------------------

def code_line(addr, data, mnemonic, operand, tag):
    hexbytes = " ".join("%02X" % b for b in data)
    text = to_ca_syntax(operand)
    if len(hexbytes) > BYTES_COL or len(mnemonic) > MNEM_COL or len(text) > OPND_COL:
        raise SystemExit("ca_emit: %04X overflows the column geometry" % addr)
    body = "%04X: %s%s%s" % (
        addr, hexbytes.ljust(BYTES_COL), mnemonic.upper().ljust(MNEM_COL), text.ljust(OPND_COL))
    return body + ("; " + tag if tag else "")


def data_rows(addr, data):
    out = []
    for i in range(0, len(data), 16):
        chunk = data[i:i + 16]
        out.append("%04X: %s" % (addr + i, " ".join("%02X" % b for b in chunk)))
    return out


def build(labels, items, tagger):
    lines = []
    run = None  # (kind, start_addr, bytes)

    def flush():
        nonlocal run
        if run is None:
            return
        kind, start, data = run
        lines.append("")
        lines.append("; ---- $%04X-$%04X: %s ----" % (start, start + len(data) - 1, kind))
        lines.extend(data_rows(start, data))
        run = None

    for item in items:
        if item[0] == "data":
            _, addr, data, kind = item
            if run and run[0] == kind and run[1] + len(run[2]) == addr:
                run[2].extend(data)
            else:
                flush()
                run = (kind, addr, list(data))
            continue

        flush()
        _, addr, data, mnemonic, operand = item
        if addr in labels:
            lines.append("")
            lines.append(labels[addr] + ":")
        lines.append(code_line(addr, data, mnemonic, operand, tag_for(mnemonic, operand, tagger)))

    flush()
    return lines


def header(parts):
    return [
        "![Donkey Kong](dkong.jpg)",
        "",
        "# Donkey Kong Main CPU (Z80)",
        "",
        ">>> cpu Z80",
        "",
        ">>> binary 0000:" + " + ".join("roms/" + p for p in parts),
        "",
        ">>> memoryTable hard",
        "",
        "[Hardware Info](Hardware.md)",
        "",
        ">>> memoryTable ram",
        "",
        "[RAM Usage](RAMUse.md)",
        "",
    ]


# ---------------------------------------------------------------------------
# verification
# ---------------------------------------------------------------------------

def round_trip(text):
    """Rebuild the ROM image from the emitted ADDR/BYTES columns alone."""
    image = bytearray(ROM_SIZE)
    written = bytearray(ROM_SIZE)
    for line in text.split("\n"):
        m = re.match(r"^([0-9A-F]{4}): ((?:[0-9A-F]{2} )*[0-9A-F]{2})(?:\s|$)", line)
        if not m:
            continue
        addr = int(m.group(1), 16)
        for i, b in enumerate(m.group(2).split()):
            if written[addr + i]:
                raise SystemExit("ca_emit: address %04X emitted twice" % (addr + i))
            image[addr + i] = int(b, 16)
            written[addr + i] = 1
    return bytes(image), written


def verify(text):
    ok = True
    image, written = round_trip(text)
    gaps = [i for i, w in enumerate(written) if not w]
    if gaps:
        ok = False
        print("ROUND-TRIP: %d addresses never emitted (first %04X)" % (len(gaps), gaps[0]))
    rom = ROM.read_bytes()
    if len(rom) != ROM_SIZE:
        ok = False
        print("ROUND-TRIP: rom/maincpu.bin is %d bytes, expected %d" % (len(rom), ROM_SIZE))
    elif image == rom:
        print("ROUND-TRIP: PASS -- all %d bytes match rom/maincpu.bin" % ROM_SIZE)
    else:
        ok = False
        bad = [i for i in range(ROM_SIZE) if image[i] != rom[i]]
        print("ROUND-TRIP: FAIL -- %d bytes differ, first at %04X (emitted %02X, rom %02X)"
              % (len(bad), bad[0], image[bad[0]], rom[bad[0]]))
    return ok


def verify_tags(text, hard_rows, ram_rows, emitted_labels):
    hard_names = {name for _, _, name, _ in hard_rows}
    ram_names = {name for _, _, name, _ in ram_rows}
    bad = []
    for tag in re.findall(r"\{(ram|hard|code)\.([A-Za-z0-9_]+)(?:\+[0-9A-F]+)?\}", text):
        kind, name = tag
        table = {"ram": ram_names, "hard": hard_names, "code": emitted_labels}[kind]
        if name not in table:
            bad.append("%s.%s" % (kind, name))
    if bad:
        print("TAGS: %d unresolved -- %s" % (len(bad), sorted(set(bad))))
    else:
        n = len(re.findall(r"\{(?:ram|hard|code)\.", text))
        print("TAGS: PASS -- all %d tags resolve" % n)
    return not bad


# Port-language markers that must not reach a public archive. The ALL-CAPS
# footers and the proper nouns are matched case-SENSITIVELY -- they are literal
# tokens, and folding case makes `GATE:` fire on an honest label like
# `boardBitGate:`. Everything else is matched case-insensitively.
LEAK_PATTERNS = [
    (r"m\.call", 0), (r"m\.step", 0), (r"T-state", 0), (r"oracle", re.I),
    (r"GATE:", 0), (r"LIVE-OUT", 0), (r"NAMES:", 0),
    (r"\[seen\]", re.I), (r"\[code\]", re.I), (r"\[guess\]", re.I), ("§", 0),
    (r"MAME", 0), (r"grounding", re.I), (r"poke", re.I), (r"equivalence-", re.I),
    (r"translated/", re.I), (r"idiomatic", re.I), (r"\bwe\b", re.I), (r"\bour\b", re.I),
    (r"The Pit", 0), (r"thepit", re.I),
]


def verify_clean(text):
    hits = []
    for pat, flags in LEAK_PATTERNS:
        for i, line in enumerate(text.split("\n"), 1):
            if re.search(pat, line, flags):
                hits.append("%s:%d: %s" % (pat, i, line))
    if hits:
        print("LEAK CHECK: %d hits" % len(hits))
        for h in hits[:40]:
            print("  " + h)
    else:
        print("LEAK CHECK: PASS -- 0 hits across %d patterns" % len(LEAK_PATTERNS))
    return not hits


# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="verify only, do not write")
    args = ap.parse_args()

    labels, items = read_asm()
    routines = read_routine_names()
    hard_rows = read_memory_table(HARDWARE)
    ram_rows = read_memory_table(RAMUSE)

    code_addrs = {it[1] for it in items if it[0] == "code"}

    # A named routine's entry gets its name; every other label keeps the
    # address-derived form. A ROUTINES address that is not an instruction
    # boundary in the disassembly gets no label -- it lies inside a data span.
    orphans = []
    for addr, name in routines.items():
        if addr in code_addrs:
            labels[addr] = name
        else:
            orphans.append(addr)

    tagger = Tagger(hard_rows, ram_rows, labels)
    body = build(labels, items, tagger)
    while body and body[0] == "":
        body.pop(0)  # the fence opens straight onto the first label
    text = "\n".join(header(read_rom_parts()) + ["```code"] + body + ["```", ""])

    if not args.check:
        OUT.write_text(text)
        print("wrote %s" % OUT)

    ok = verify(text)
    ok &= verify_tags(text, hard_rows, ram_rows, set(labels.values()))
    ok &= verify_clean(text)

    print("LINES: %d" % (len(text.split("\n")) - 1))
    named = sum(1 for a in labels if a in routines)
    print("LABELS: %d (%d from the names registry, %d address-derived)"
          % (len(labels), named, len(labels) - named))
    data_bytes = sum(len(it[2]) for it in items if it[0] == "data")
    print("DATA: %d bytes emitted as data blocks (%.1f%% of the ROM)"
          % (data_bytes, 100.0 * data_bytes / ROM_SIZE))
    if orphans:
        print("NOTE: %d named routine addresses are not instruction boundaries in the "
              "disassembly and carry no label: %s"
              % (len(orphans), ", ".join("%04X" % a for a in sorted(orphans))))

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
