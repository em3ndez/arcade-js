#!/usr/bin/env python3
"""Generic "Computer Archeology" contrib emitter: emit a game's data-driven CA
pages (RAMUse.md + Code.md) into games/<game>/contrib/computerarcheology/, in
the committed The-Pit format. Design notes, format spec and ship posture live in
tools/README-ca-contrib.md. Usage: gen_ca_contrib.py <game> [out_dir]."""

import json
import os
import re
import sys
import textwrap

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ------------------------------------------------------------- column geometry
ADDR_W = 6           # "AAAA: "
BYTES_W = 16         # raw-byte field
MNEM_W = 8           # mnemonic field
OPER_W = 20          # operand field  (6+16+8+20 = 50 -> ';' lands at column 50)
ROLE_WRAP = 72       # role-block prose wrap width (content, before the "; ")

BRANCH = ("call", "jp", "jr", "djnz")
TAG_RE = re.compile(r"\[(?:code|seen|guess)\]")

# Per-game intro paragraph for the Code.md ```code block. Falls back to a line
# built from the manifest when a game is absent here.
GAME_DESC = {
    "timeplt": (
        "Time Pilot (Konami, 1982). A free-roaming aerial shooter: your fighter "
        "holds the centre of the screen and turns to face the way you steer, while "
        "the whole world scrolls and banks around it, and you gun down swarms of "
        "enemy craft and the boss mother-ship that anchors each wave. Clearing a "
        "wave carries you forward through five eras of flight, each faster and more "
        "crowded than the last; parachutists drifting down are worth extra points "
        "if you collect them. Run out of fighters to end the game."
    ),
}

# Reached spans that are actually anti-tamper obfuscation: a deliberately misaligned
# "wrong-glyph" derail entry whose bytes execute as harmless NOPs / stray-stack POPs.
# Decoding them as code yields off-convention DEFBs (undefined opcodes) that choke the
# deploy tool, so we render them as CA data blocks and move the routine name+role to the
# real entry. Tuple: (start, end, block-label, lead-comment, name_src) -- name_src is a
# names.js routine addr whose name+role is shown at END+1 (the real entry) instead of at
# start, or None. See scratchpad/CA-topher-459b-followup.md.
FORCE_DATA = {
    "timeplt": [
        (0x459b, 0x45b2, "misaligned anti-tamper entry",
         'reached only via the "wrong-glyph" derail ($1772) and the loop-back ($4660); the '
         "bytes run as harmless NOPs and stray-stack POPs. The real routine is at $45B3.",
         0x459b),
        (0x49fa, 0x4a0e, "misaligned anti-tamper entry",
         'reached only via the "wrong-glyph" derail ($19E6); the bytes run as harmless NOPs and '
         "stray-stack POPs. The real routine is at $4A0F.",
         None),
    ],
}


# --------------------------------------------------------------------- helpers
def camel(name):
    """UPPER_SNAKE_CASE -> camelCase (SOUND_QUEUE_COUNT -> soundQueueCount)."""
    parts = name.split("_")
    return parts[0].lower() + "".join(p[:1].upper() + p[1:].lower() for p in parts[1:])


def clean_desc(text, upper_name=None):
    """Reduce a raw JSDoc/inline comment line to one clean prose sentence.

    Robust across both names.js JSDoc styles (timeplt and thepit): strips the
    JSDoc frame (`/**`/`/*`/leading `*`/trailing `*/`), removes every
    `[code]`/`[seen]`/`[guess]` evidence tag WHEREVER it sits (start, middle, or
    tag-then-`*/` at the end), collapses whitespace, and drops a leading
    `NAME (0xADDR) —` / `NAME —` self-preamble (thepit) so the text reads as
    prose, not `CREDIT_COUNT (0x8000) — ...`. Never leaks a `*/`, a tag, or a
    preamble; never truncates mid-token."""
    if not text:
        return ""
    s = text.strip()
    s = re.sub(r"^/\*+!?", "", s)          # leading /** or /* (or /*!)
    s = re.sub(r"^\*+", "", s)             # leading * line-marker(s)
    s = re.sub(r"\*/\s*$", "", s)          # trailing */ (survives even after a tag)
    s = TAG_RE.sub("", s)                  # evidence tags anywhere
    s = re.sub(r"\s+", " ", s).strip()     # normalise inner whitespace
    if upper_name:                         # drop `NAME (0xADDR) —` / `NAME —` self-preamble
        s = re.sub(r"^" + re.escape(upper_name) +
                   r"\s*(?:\(0x[0-9a-fA-F]+\))?\s*[—–:\-]+\s*", "", s)
    # A residual mid-prose `(0xADDR) — gloss` is the same address-annotation device
    # as the self-preamble; render it as prose (`(0xADDR): gloss`) so no `(hex) —`
    # survives to read as a leaked preamble.
    s = re.sub(r"(\(0x[0-9a-fA-F]+\))\s*[—–]\s+", r"\1: ", s)
    return s.strip()


def strip_marker(st):
    """Strip one comment line's leading frame (`/**`/`/*`/`*`/`//`/`── ` rule) and
    any trailing `*/`, leaving just its prose so sibling lines can be joined."""
    st = st.strip()
    st = re.sub(r"^/\*+!?", "", st)             # /** or /* or /*!
    st = re.sub(r"\*/\s*$", "", st)             # trailing */
    st = re.sub(r"^\*+", "", st)                # JSDoc line marker *
    st = re.sub(r"^//+", "", st)                # // line comment
    st = re.sub(r"^\s*[─–—\-]+\s*", "", st)     # `── ` group-header rule
    return st.strip()


# Abbreviations whose trailing period is NOT a sentence end (checked case-folded).
_ABBREV = ("e.g.", "i.e.", "etc.", "vs.", "cf.", "al.", "fig.", "no.",
           "approx.", "ca.", "resp.", "incl.", "eq.", "eqn.", "viz.", "sp.")


def first_sentence(s, min_len=16):
    """The first COMPLETE sentence of `s` -- never cut mid-word or mid-clause.

    A boundary is a `.`/`!`/`?` that ends the string or is followed by whitespace
    (so `8.8`, `§2.5`, `0xAB08..0xAB2F` and hex are NOT boundaries -- no space
    follows the dot) and is not a known abbreviation (`e.g.`/`i.e.`/`etc.`). A very
    short leading label (`Scoring.`) is extended to the next boundary so the row is
    substantive; if the string holds no boundary the whole (complete) phrase is
    returned."""
    if not s:
        return ""
    s = s.strip()
    n = len(s)
    for i, ch in enumerate(s):
        if ch not in ".!?":
            continue
        if i + 1 < n and not s[i + 1].isspace():
            continue                            # decimal / hex / section ref
        head = s[:i + 1]
        if any(head.lower().endswith(a) for a in _ABBREV):
            continue                            # abbreviation, not a sentence end
        if i + 1 >= n or len(head) >= min_len:
            return head.strip()
    return s


_UPPER_TOKEN = re.compile(r"[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+")   # a cell-constant name shape


def _split_sentences(s, min_len=16):
    """`s` as a list of its complete sentences (first_sentence applied repeatedly)."""
    out, rest = [], s.strip()
    while rest:
        head = first_sentence(rest, min_len)
        nxt = rest[len(head):].strip()
        if not head or nxt == rest:
            out.append(rest)
            break
        out.append(head)
        rest = nxt
    return out


def group_sentence(paragraph, own_upper, siblings):
    """Choose a shared `// --` group header's sentence for ONE cell under it.

    A group header's opening sentence often singles out ONE member by name
    (`HIGH_SCORE_HI is the MSB ...`); attributing that to a SIBLING states a
    falsehood. So skip any sentence naming a different cell constant, taking the
    first that names only this cell or none (else the plain first sentence)."""
    sents = _split_sentences(paragraph)
    for s in sents:
        if not any(t != own_upper and t in siblings for t in _UPPER_TOKEN.findall(s)):
            return s
    return sents[0] if sents else ""


def unescape(s):
    return s.replace('\\"', '"').replace("\\\\", "\\")


# ------------------------------------------------------------------ map builds
def build_cells(names_path, lo, hi):
    """[(addr, camelName, description)] for every work-RAM `export const`.

    Per-cell description precedence: the inline `// ...` comment; else the JSDoc
    block directly above it; else the `// ──` group block the cell sits under (some
    cells -- e.g. the score bytes -- are only documented by their shared group
    header). Whichever the source, its FIRST PARAGRAPH's content lines are joined
    (unwrapping the hard-wrapped source) and reduced to the first COMPLETE sentence
    (`first_sentence`) -- so a row never ends mid-clause. Always cleaned: no
    evidence tag, no JSDoc frame, no `NAME (0xADDR) —` self-preamble.
    """
    text = open(names_path).read()
    lines = text.split("\n")
    siblings = set(re.findall(r"^export const ([A-Z_0-9]+) = 0x[0-9a-f]{4};", text, re.M))
    cells = []
    jsdoc_para = None      # first-paragraph lines of the JSDoc block above a cell
    group_para = None      # lines of the `// ──` group block the cell sits under
    in_jsdoc = False
    para_open = False      # still collecting the JSDoc block's FIRST paragraph
    export_re = re.compile(
        r"^export const ([A-Z_0-9]+) = (0x[0-9a-f]{4});(?:\s*//\s*(.*))?\s*$")
    group_head_re = re.compile(r"^//+\s*[─–—\-]+\s*\S")
    for line in lines:
        st = line.strip()
        # ---- open a JSDoc block (supersedes any pending group header) ----
        if not in_jsdoc and (st.startswith("/**") or
                             (st.startswith("/*") and not st.startswith("/*!"))):
            in_jsdoc, para_open, jsdoc_para, group_para = True, True, [], None
        if in_jsdoc:
            if para_open:
                content = strip_marker(st)
                if content:
                    jsdoc_para.append(content)
                elif jsdoc_para:
                    para_open = False        # first blank line ends the summary paragraph
            if "*/" in st:                   # closes single- AND multi-line blocks
                in_jsdoc = False
            continue
        # ---- `// ── <header>` group block + its continuation `//` lines ----
        if group_head_re.match(st):
            group_para = [strip_marker(st)]
            continue
        if group_para is not None and st.startswith("//"):
            c = strip_marker(st)
            if c:
                group_para.append(c)
            continue
        m = export_re.match(line)
        if not m:
            continue
        name, addr_s, inline = m.group(1), m.group(2), m.group(3)
        addr = int(addr_s, 16)
        if not (lo <= addr <= hi):
            jsdoc_para = None
            continue
        from_group = False
        if inline:
            raw = inline
        elif jsdoc_para:
            raw = " ".join(jsdoc_para)
        elif group_para:
            raw, from_group = " ".join(group_para), True
        else:
            raw = ""
        cleaned = clean_desc(raw, name)
        desc = (group_sentence(cleaned, name, siblings) if from_group
                else first_sentence(cleaned)).replace("|", r"\|")
        cells.append((addr, camel(name), desc))
        jsdoc_para = None
    cells.sort(key=lambda t: t[0])
    return cells


def build_routines(names_path):
    """addr -> (name, role, cert) for every ROUTINES entry.

    Widened vs gen_semantic_disasm.build_role_map to also catch the multi-line
    `0xADDR: {\\n name:..\\n role:..\\n cert:.. }` form and entries with a
    trailing `why:` field (single- or double-quoted)."""
    text = open(names_path).read()
    block = text[text.index("export const ROUTINES = {"):]
    entry = re.compile(
        r'0x([0-9a-f]{4}):\s*\{\s*name:\s*"([^"]*)"\s*,\s*'
        r'role:\s*"((?:[^"\\]|\\.)*)"\s*,\s*cert:\s*"([^"]*)"',
        re.S,
    )
    m = {}
    for a, n, r, c in entry.findall(block):
        m[int(a, 16)] = (n, unescape(r), c)
    # sanity: every `0xADDR: {` opener must have been captured.
    openers = re.findall(r"^  0x[0-9a-f]{4}: \{", block, re.M)
    assert len(openers) == len(m), \
        f"ROUTINES parse gap: {len(openers)} openers but {len(m)} parsed"
    return m


def clean_role(text):
    """A ROUTINES role cleaned for the clean-room CA header (drop ★, tags, §, MAME/LIVE-OUT;
    loc_XXXX -> $XXXX so no raw disassembler label leaks into the prose)."""
    t = text.replace("★", "")
    t = TAG_RE.sub("", t)
    t = re.sub(r"\bgrounded in MAME\b\s*(?:as|by|in|:)?\s*", "", t, flags=re.I)
    t = re.sub(r"§\S*", "", t)
    t = re.sub(r"[;,]?\s*\blive-?out\b.*", "", t, flags=re.I)
    t = re.sub(r"\bloc_([0-9a-f]{4})\b", lambda mm: "$" + mm.group(1).upper(), t)
    return re.sub(r"\s+", " ", t).strip()


def build_notes(gdir):
    """addr -> per-instruction clean-room gloss from <game>/ca-lines.md (`ADDR<TAB>text`
    per line), else {}. See docs/contributing-disassembly.md."""
    path = os.path.join(gdir, "ca-lines.md")
    notes = {}
    if os.path.exists(path):
        for ln in open(path).read().split("\n"):
            a, tab, txt = ln.partition("\t")
            if tab and re.fullmatch(r"[0-9a-fA-F]{4}", a.strip()) and txt.strip():
                notes[int(a.strip(), 16)] = txt.strip()
    return notes


def work_ram_region(game):
    """(lo, hi) of the work-RAM region, from boards/<game>/hardware.json's `work`
    stateRegion -- the board layer's own source of truth, so a game whose work RAM
    is placed or sized differently is read, not assumed. Fails loud if absent."""
    hw_path = os.path.join(REPO, "boards", game, "hardware.json")
    work = next((r for r in json.load(open(hw_path)).get("stateRegions", [])
                 if r.get("name") == "work"), None)
    assert work, f"no 'work' stateRegion in {hw_path}"
    return work["base"], work["base"] + work["size"] - 1


def parse_manifest(gdir):
    """title / manufacturer / year / cpu / maincpu ROM parts / ROM size."""
    text = open(os.path.join(gdir, "manifest.js")).read()

    def field(k, default=None):
        m = re.search(k + r':\s*"([^"]+)"', text)
        return m.group(1) if m else default

    meta = {
        "title": field("title", "Unknown"),
        "manufacturer": field("manufacturer", ""),
        "cpu": (field("cpu", "z80")).upper(),
    }
    ym = re.search(r"year:\s*(\d+)", text)
    meta["year"] = ym.group(1) if ym else ""
    mc = re.search(r"maincpu:\s*\{(.*?)\}", text, re.S)
    parts, size = [], 0x10000
    if mc:
        pm = re.search(r"parts:\s*\[([^\]]*)\]", mc.group(1))
        if pm:
            parts = re.findall(r'"([^"]+)"', pm.group(1))
        sm = re.search(r"size:\s*(0x[0-9a-fA-F]+|\d+)", mc.group(1))
        if sm:
            size = int(sm.group(1), 0)
    meta["rom_parts"] = parts
    meta["rom_size"] = size
    return meta


# ------------------------------------------------------------- RAMUse.md build
def gen_ramuse(meta, cells, wr_lo, wr_hi):
    lo, hi = wr_lo, wr_hi   # the work-RAM REGION span, not the last named cell
    out = []
    game_img = meta["_game"] + ".jpg"
    out.append(f"![{meta['title']}]({game_img})")
    out.append("")
    out.append("# RAM Usage")
    out.append("")
    out.append(f"Work RAM lives at `0x{lo:04X}`–`0x{hi:04X}`. Each name below describes "
               "the cell by its role in")
    out.append("the running game; the hex address is the stable identity. Cells that share a byte, or")
    out.append("whose role is only partly pinned, carry a terse caveat.")
    out.append("")
    out.append(">>> memory")
    out.append("")
    out.append("| Address | Name | Description |")
    out.append("| --- | --- | --- |")
    for addr, name, desc in cells:
        out.append(f"| {addr:04x} | {name} | {desc} |")
    return "\n".join(out) + "\n"


# --------------------------------------------------------------- Code.md build
def fmt_operand(operand):
    """Uppercase registers/conditions; 0x.. -> $..  (uppercase hex)."""
    op = re.sub(r"0x([0-9a-fA-F]+)", lambda m: "$" + m.group(1).upper(), operand)
    return op.upper()


def token_for(mnem, operand, routines, labels, wr_lo, wr_hi, rom_hi):
    """The trailing CA cross-reference token, or None."""
    if mnem in BRANCH:
        hits = re.findall(r"0x([0-9a-f]+)", operand)  # target is the last address
        if not hits:
            return None
        tgt = int(hits[-1], 16)
        rn = routines.get(tgt)
        if rn and not rn[0].startswith("loc_"):
            return "{code.%s}" % rn[0]
        if tgt in labels:
            return "{code.loc_%04x}" % tgt
        return None
    m = re.search(r"\(0x([0-9a-f]{4})\)", operand)  # only absolute (..) accesses
    if not m:
        return None
    tgt = int(m.group(1), 16)
    if wr_lo <= tgt <= wr_hi:
        off = tgt - wr_lo
        return "{hard.workRam}" if off == 0 else "{hard.workRam+%X}" % off
    if 0 <= tgt <= rom_hi:
        return "{hard.rom}" if tgt == 0 else "{hard.rom+%X}" % tgt
    return None


def xform_instr(raw, routines, labels, wr_lo, wr_hi, rom_hi, notes):
    code, _, comment = raw.partition(";")
    m = re.match(r"\s*([0-9a-f]+)\s+([0-9a-f ]+?)\s*$", comment)
    addr = m.group(1).upper()
    rawbytes = " ".join(b.upper() for b in m.group(2).split())
    code = code.strip()
    parts = code.split(None, 1)
    mnem = parts[0]
    operand = parts[1].strip() if len(parts) > 1 else ""
    op_out = fmt_operand(operand)
    tok = token_for(mnem, operand, routines, labels, wr_lo, wr_hi, rom_hi)
    gloss = notes.get(int(m.group(1), 16))
    line = f"{addr}: {rawbytes.ljust(BYTES_W)}{mnem.upper().ljust(MNEM_W)}{op_out.ljust(OPER_W)}"
    tail = " ".join(x for x in (tok, gloss) if x)
    if tail:
        line += "; " + tail
    return line


def _line_addr(line):
    """The address a dk.asm line sits at (label or instruction), or None."""
    m = re.match(r"^loc_([0-9a-f]+):\s*$", line)
    if m:
        return int(m.group(1), 16)
    if re.match(r"^    [a-z]", line):
        _, sep_, comment = line.partition(";")
        am = re.match(r"\s*([0-9a-f]+)\s", comment) if sep_ else None
        if am:
            return int(am.group(1), 16)
    return None


def _line_bytes(line):
    """The raw bytes of a dk.asm instruction line (from its `; addr b b ...`), or None."""
    _, sep_, comment = line.partition(";")
    if not sep_:
        return None
    bm = re.match(r"\s*[0-9a-f]+\s+([0-9a-f ]+?)\s*$", comment)
    return [int(b, 16) for b in bm.group(1).split()] if bm else None


def emit_data(body, start, end, data, label):
    """A thepit-style data block: `; ---- $A-$B: <label> ----` + 16-byte rows
    (region-relative, uppercase hex)."""
    body.append("; ---- $%04X-$%04X: %s ----" % (start, end, label))
    for k in range(0, len(data), 16):
        row = data[k:k + 16]
        body.append("%04X: %s" % (start + k, " ".join("%02X" % b for b in row)))


def gen_code(meta, raw_lines, routines, wr_lo, wr_hi, rom_hi, notes):
    labels = set()
    for l in raw_lines:
        lm = re.match(r"^loc_([0-9a-f]+):\s*$", l)
        if lm:
            labels.add(int(lm.group(1), 16))

    # Anti-tamper obfuscation spans -> data blocks. `eff` is `routines` with the covered
    # bytes removed (they are data, not named routines) and each block's name+role moved
    # to the real entry (END+1); references into a block then render as a raw $addr.
    force = FORCE_DATA.get(meta["_game"], [])
    force_start = {f[0]: f for f in force}
    force_addrs = set()
    eff = dict(routines)
    for (s, e, _lbl, _cmt, src) in force:
        if src is not None and src in routines:
            eff[e + 1] = routines[src]
        for a in range(s, e + 1):
            eff.pop(a, None)
            force_addrs.add(a)
    labels = labels - force_addrs

    # ---- top matter (mirrors thepit/Code.md) ----
    game = meta["_game"]
    head = []
    head.append(f"![{meta['title']}]({game}.jpg)")
    head.append("")
    head.append(f"# {meta['title']}")
    head.append("")
    head.append(f">>> cpu {meta['cpu']}")
    head.append("")
    binline = " + ".join("roms/" + p for p in meta["rom_parts"]) or "roms/maincpu"
    head.append(f">>> binary 0000:{binline}")
    head.append("")
    head.append(">>> memoryTable hard")
    head.append("")
    head.append("[Hardware Info](Hardware.md)")
    head.append("")
    head.append(">>> memoryTable ram")
    head.append("")
    head.append("[RAM Usage](RAMUse.md)")
    head.append("")
    head.append("```code")

    # ---- description block ----
    desc = GAME_DESC.get(game)
    if not desc:
        bits = [meta["title"]]
        if meta["manufacturer"] or meta["year"]:
            bits.append("(" + ", ".join(x for x in (meta["manufacturer"], meta["year"]) if x) + ")")
        desc = " ".join(bits) + "."
    dlines = ["; " + w for w in textwrap.wrap(desc, 76)]
    # reset-handoff + reachability note, derived from dk.asm
    reset_tgt = None
    for l in raw_lines:
        jm = re.match(r"^    jp 0x([0-9a-f]+)\s*;", l)
        if jm:
            reset_tgt = int(jm.group(1), 16)
            break
    arch = ""
    if reset_tgt is not None:
        rn = routines.get(reset_tgt)
        who = rn[0] if (rn and not rn[0].startswith("loc_")) else "loc_%04x" % reset_tgt
        arch = (f"Architecture: on reset ($0000) the CPU jumps to {who} "
                f"(${reset_tgt:04X}). ")
    arch += ('What follows is the code reached from the reset and interrupt entry points, '
             'shown as instructions; spans never reached appear as data (the "---- data '
             '----" blocks).')
    dlines.append(";")
    dlines += ["; " + w for w in textwrap.wrap(arch, 76)]

    # ---- body ----
    body = []

    def sep():
        if body and body[-1] != "":
            body.append("")

    # start at the first label; drop dk.asm's own header preamble.
    j = 0
    while j < len(raw_lines) and not raw_lines[j].startswith("loc_"):
        j += 1
    n = len(raw_lines)
    while j < n:
        line = raw_lines[j]
        if line.strip() == "":
            j += 1
            continue
        ah = _line_addr(line)
        if ah is not None and ah in force_start:
            s, e, lbl, cmt, _src = force_start[ah]
            data = []
            while j < n:
                a = _line_addr(raw_lines[j])
                if a is not None and a > e:
                    break
                bs = _line_bytes(raw_lines[j])
                if bs:
                    data += bs
                j += 1
            assert len(data) == e - s + 1, f"force-data 0x{s:04x}: got {len(data)} != {e - s + 1}"
            sep()
            for w in textwrap.wrap(cmt, ROLE_WRAP):
                body.append("; " + w)
            emit_data(body, s, e, data, lbl)
            continue
        lm = re.match(r"^loc_([0-9a-f]+):\s*$", line)
        if lm:
            addr = int(lm.group(1), 16)
            sep()
            rn = eff.get(addr)
            if rn and not rn[0].startswith("loc_"):
                for w in textwrap.wrap(clean_role(rn[1]), ROLE_WRAP):
                    body.append("; " + w)
                body.append(rn[0] + ":")
            else:
                body.append("loc_%04x:" % addr)
            j += 1
            continue
        um = re.match(r"^; ==== UNREACHED 0x([0-9a-f]+)-0x([0-9a-f]+) \((\d+) bytes\) ====\s*$", line)
        if um:
            start, end, nby = int(um.group(1), 16), int(um.group(2), 16), int(um.group(3))
            j += 1
            data = []
            while j < n:
                dm = re.match(r"^\s*;\s*[0-9a-f]+:\s+defb\s+(.*)$", raw_lines[j])
                if not dm:
                    break
                for tok in dm.group(1).split(","):
                    hm = re.match(r"0x([0-9a-f]{1,2})", tok.strip())
                    if hm:
                        data.append(int(hm.group(1), 16))
                j += 1
            assert len(data) == nby, f"data region 0x{start:04x}: {len(data)} bytes != {nby}"
            sep()
            emit_data(body, start, end, data, "data")
            continue
        # An inline jump table: reachable word-pointer table. The Pit has no DW
        # construct (its tables are all UNREACHED), so -- to stay in its format --
        # render it as a data block, the pointer words as little-endian bytes.
        tm = re.match(r"^; ---- inline jump table 0x([0-9a-f]+)-0x([0-9a-f]+) ----\s*$", line)
        if tm:
            start, end = int(tm.group(1), 16), int(tm.group(2), 16)
            j += 1
            data = []
            while j < n:
                wm = re.match(r"^\s*dw\s+0x([0-9a-f]{1,4})\b", raw_lines[j])
                if not wm:
                    break
                w = int(wm.group(1), 16)
                data += [w & 0xFF, (w >> 8) & 0xFF]      # little-endian
                j += 1
            assert len(data) == end - start + 1, \
                f"jump table 0x{start:04x}: {len(data)} bytes != {end-start+1}"
            sep()
            emit_data(body, start, end, data, "jump table")
            continue
        if re.match(r"^    [a-z]", line):
            body.append(xform_instr(line, eff, labels, wr_lo, wr_hi, rom_hi, notes))
            j += 1
            continue
        j += 1  # anything else (should not occur) is dropped

    out = head + dlines + ["", ""] + body + ["```"]
    return "\n".join(out) + "\n"


# --------------------------------------------------------------------- driver
def main():
    if len(sys.argv) not in (2, 3):
        sys.exit("usage: gen_ca_contrib.py <game> [out_dir]")
    game = sys.argv[1]
    gdir = os.path.join(REPO, "games", game)
    names_path = os.path.join(gdir, "idiomatic/names.js")
    raw_path = os.path.join(gdir, "out/dk.asm")
    # Default output is the game's own contrib dir; an explicit out_dir lets a
    # caller emit elsewhere (e.g. a scratch dir) WITHOUT writing into a finished
    # game's committed contrib -- used for the generalization diff.
    out_dir = sys.argv[2] if len(sys.argv) == 3 else os.path.join(gdir, "contrib/computerarcheology")
    os.makedirs(out_dir, exist_ok=True)

    meta = parse_manifest(gdir)
    meta["_game"] = game
    rom_hi = meta["rom_size"] - 1

    # work-RAM region from the board layer (TP 0xA800-0xAFFF, The Pit 0x8000-0x87FF);
    # cells outside it (ROM tables, colour/video/sprite RAM) are not RAMUse rows.
    wr_lo, wr_hi = work_ram_region(game)
    all_cells = build_cells(names_path, 0x0000, 0xFFFF)
    cells = [c for c in all_cells if wr_lo <= c[0] <= wr_hi]

    routines = build_routines(names_path)
    raw_lines = open(raw_path).read().split("\n")

    ramuse = gen_ramuse(meta, cells, wr_lo, wr_hi)
    notes = build_notes(gdir)
    code = gen_code(meta, raw_lines, routines, wr_lo, wr_hi, rom_hi, notes)

    with open(os.path.join(out_dir, "RAMUse.md"), "w") as fh:
        fh.write(ramuse)
    with open(os.path.join(out_dir, "Code.md"), "w") as fh:
        fh.write(code)

    named = sum(1 for a, (n, r, c) in routines.items() if not n.startswith("loc_"))
    print(f"game   : {game}  ({meta['title']}, {meta['cpu']})")
    print(f"out    : {out_dir}/RAMUse.md  ({len(cells)} work-RAM cells)")
    print(f"out    : {out_dir}/Code.md")
    print(f"workRAM: 0x{wr_lo:04X}-0x{wr_hi:04X}   ROM: 0x0000-0x{rom_hi:04X}")
    print(f"routines: {len(routines)} total, {named} English-named, {len(routines)-named} loc_")


if __name__ == "__main__":
    main()
