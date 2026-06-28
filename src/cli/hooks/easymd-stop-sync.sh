#!/usr/bin/env bash
# easymd auto-sync Stop hook (adapted from the obsidian-wiki Stop-capture pattern).
#
# Fires on the Claude Code Stop event. If the session edited any .md files and you're
# logged into easymd, it pushes those docs to your account — so your markdown stays
# updated in easymd after every agent session, everywhere, with no daemon running.
#
# Always exits 0 (silent): it runs the sync directly, it never nudges Claude.
set -euo pipefail

INPUT=$(cat)

# Need credentials — no-op if not logged in.
[[ -f "$HOME/.easymd/credentials.json" ]] || exit 0

# Pull cwd + transcript path from the hook payload.
read -r CWD TRANSCRIPT < <(printf '%s' "$INPUT" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(d.get('cwd', ''), d.get('transcript_path', ''))
" 2>/dev/null || echo " ")
[[ -n "$TRANSCRIPT" && -f "$TRANSCRIPT" ]] || exit 0

# Did this session write/edit any .md files?
EDITED_MD=$(python3 - "$TRANSCRIPT" <<'PYEOF'
import json, sys
n = 0
for line in open(sys.argv[1]):
    line = line.strip()
    if not line:
        continue
    try:
        e = json.loads(line)
    except json.JSONDecodeError:
        continue
    m = e.get("message") or {}
    if m.get("role") != "assistant":
        continue
    for b in m.get("content") or []:
        if isinstance(b, dict) and b.get("type") == "tool_use" and b.get("name") in ("Write", "Edit", "NotebookEdit"):
            fp = (b.get("input") or {}).get("file_path", "")
            if fp.endswith(".md"):
                n += 1
print(n)
PYEOF
)
[[ "${EDITED_MD:-0}" -ge 1 ]] || exit 0

# Resolve the easymd CLI from this script's own package (no PATH dependency).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EASYMD_BIN="$SCRIPT_DIR/../../../bin/easymd.js"
[[ -f "$EASYMD_BIN" ]] || exit 0

cd "${CWD:-$PWD}" 2>/dev/null || exit 0
node "$EASYMD_BIN" sync . --quiet >/dev/null 2>&1 || true
exit 0
