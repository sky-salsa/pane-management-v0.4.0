#!/usr/bin/env bash
# verify-release.sh — Scan a release directory for personal data leaks.
# Usage: bash verify-release.sh [directory]
# Exit 0 = clean (no BLOCKs), Exit 1 = BLOCKs found.
set -uo pipefail

TARGET_DIR="${1:-.}"
BLOCKS=0
WARNS=0

RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
BOLD='\033[1m'
NC='\033[0m'

# ── Helpers ──

report() {
    local sev="$1" file="$2" line="$3" match="$4" rule="$5"
    if [ "$sev" = "BLOCK" ]; then
        echo -e "  ${RED}[BLOCK]${NC} ${file}:${line}  ${BOLD}${match}${NC}  (${rule})"
        BLOCKS=$((BLOCKS + 1))
    else
        echo -e "  ${YELLOW}[WARN]${NC}  ${file}:${line}  ${BOLD}${match}${NC}  (${rule})"
        WARNS=$((WARNS + 1))
    fi
}

# Grep wrapper: scans text files, reports each match
scan_pattern() {
    local pattern="$1" severity="$2" rule="$3" exclude_pattern="${4:-}"
    local results
    results=$(grep -rn --binary-files=without-match --include='*.rs' --include='*.ts' --include='*.tsx' \
        --include='*.md' --include='*.json' --include='*.jsonl' --include='*.toml' \
        --include='*.sh' --include='*.ps1' --include='*.css' --include='*.html' \
        -E "$pattern" "$TARGET_DIR" 2>/dev/null || true)

    if [ -n "$exclude_pattern" ]; then
        results=$(echo "$results" | grep -v -E "$exclude_pattern" || true)
    fi

    while IFS= read -r line; do
        [ -z "$line" ] && continue
        local file lineno match
        file=$(echo "$line" | cut -d: -f1)
        lineno=$(echo "$line" | cut -d: -f2)
        match=$(echo "$line" | cut -d: -f3- | head -c 80)
        report "$severity" "$file" "$lineno" "$match" "$rule"
    done <<< "$results"
}

echo -e "${BOLD}═══ Release Verification Scan ═══${NC}"
echo "Target: $TARGET_DIR"
echo ""

# ── Scan 1: Known personal patterns (BLOCK) ──
# Note: exclude the scripts themselves to avoid self-detection of pattern strings
echo -e "${BOLD}Scan 1: Known personal data patterns${NC}"
scan_pattern 'Users[/\\]Sky' "BLOCK" "known-username-path" "sky-salsa|verify-release\.sh|prepare-release\.sh"
scan_pattern 'Users-Sky' "BLOCK" "known-username-encoded" "sky-salsa|verify-release\.sh|prepare-release\.sh"
scan_pattern '/home/sky[/"]' "BLOCK" "known-wsl-home" "verify-release\.sh|prepare-release\.sh"
scan_pattern '%2FUSERNAME%2F|%2FUsers%2FUSERNAME|%5CUSERNAME%5C' "BLOCK" "known-url-encoded" "verify-release\.sh|prepare-release\.sh"
# Build the private project name pattern indirectly to avoid self-detection
PRIV_PROJ="Cingu""late"
scan_pattern "$PRIV_PROJ" "BLOCK" "private-project-name" "verify-release\.sh|prepare-release\.sh"

# ── Scan 2: Dynamic WSL username (BLOCK) ──
echo -e "${BOLD}Scan 2: Dynamic username detection${NC}"
WSL_USER="$(whoami 2>/dev/null || echo '')"
if [ -n "$WSL_USER" ] && [ "$WSL_USER" != "root" ] && [ "$WSL_USER" != "USERNAME" ] && [ "$WSL_USER" != "username" ]; then
    scan_pattern "/home/$WSL_USER[/\"]" "BLOCK" "dynamic-wsl-user" ""
fi

# ── Scan 3: Windows username from /mnt/c/Users/ (BLOCK) ──
echo -e "${BOLD}Scan 3: Windows username detection${NC}"
if [ -d "/mnt/c/Users" ]; then
    WIN_USER=$(ls /mnt/c/Users/ 2>/dev/null | grep -v -E '^(Public|Default|Default User|All Users|desktop\.ini)$' | head -1)
    if [ -n "$WIN_USER" ] && [ "$WIN_USER" != "USERNAME" ]; then
        scan_pattern "Users[/\\\\]$WIN_USER" "BLOCK" "dynamic-win-user" "sky-salsa"
    fi
fi

# ── Scan 4: Email addresses (WARN) ──
echo -e "${BOLD}Scan 4: Email addresses${NC}"
scan_pattern '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' "WARN" "email-address" \
    'noreply@|@example\.com|@tauri-apps|@anthropic|@thisbeyond|@neodrag|@2x\.png|@3x\.png|@1x\.png'

# ── Scan 5: IP addresses (WARN) ──
echo -e "${BOLD}Scan 5: IP addresses${NC}"
scan_pattern '\b[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\b' "WARN" "ip-address" \
    '127\.0\.0\.1|0\.0\.0\.0|255\.255|localhost|0\.3\.|0\.7\.|0\.9\.|1\.9\.|2\.1[0-9]\.|version'

# ── Scan 6: SSH/key material (BLOCK) ──
echo -e "${BOLD}Scan 6: SSH and key material${NC}"
scan_pattern 'BEGIN.*PRIVATE KEY' "BLOCK" "private-key" "verify-release\.sh"
scan_pattern 'ssh-rsa [A-Za-z0-9+/]' "BLOCK" "ssh-public-key" "verify-release\.sh"
scan_pattern 'ssh-ed25519 [A-Za-z0-9+/]' "BLOCK" "ssh-public-key" "verify-release\.sh"

# ── Scan 7: API key patterns (BLOCK for known prefixes) ──
echo -e "${BOLD}Scan 7: API keys and secrets${NC}"
scan_pattern 'sk-ant-[a-zA-Z0-9]' "BLOCK" "anthropic-api-key" "verify-release\.sh|prepare-release\.sh|SETUP-GUIDE"
scan_pattern 'ghp_[a-zA-Z0-9]' "BLOCK" "github-pat" "verify-release\.sh"
scan_pattern 'ghs_[a-zA-Z0-9]' "BLOCK" "github-secret" "verify-release\.sh"
# Generic long sk- tokens (not short "sk-" in prose)
scan_pattern 'sk-[a-zA-Z0-9]{20,}' "BLOCK" "long-secret-key" 'sk-ant-|verify-release\.sh'

# ── Scan 8: .env files (BLOCK) ──
echo -e "${BOLD}Scan 8: Environment files${NC}"
ENV_FILES=$(find "$TARGET_DIR" -name ".env" -o -name ".env.*" -o -name ".env.local" 2>/dev/null || true)
while IFS= read -r f; do
    [ -z "$f" ] && continue
    report "BLOCK" "$f" "0" "(entire file)" "env-file-leaked"
done <<< "$ENV_FILES"

# ── Scan 9: Credential files (BLOCK) ──
echo -e "${BOLD}Scan 9: Credential files${NC}"
CRED_FILES=$(find "$TARGET_DIR" -name "credentials.json" -o -name "*.pem" -o -name "*.key" -o -name "id_rsa*" -o -name "id_ed25519*" 2>/dev/null || true)
while IFS= read -r f; do
    [ -z "$f" ] && continue
    report "BLOCK" "$f" "0" "(entire file)" "credential-file"
done <<< "$CRED_FILES"

# ── Summary ──
echo ""
echo -e "${BOLD}═══════════════════════════════${NC}"
echo -e "Findings: ${RED}$BLOCKS BLOCK(s)${NC}, ${YELLOW}$WARNS WARN(s)${NC}"
if [ $BLOCKS -gt 0 ]; then
    echo -e "${RED}RESULT: BLOCKED — fix $BLOCKS issue(s) before release${NC}"
    exit 1
else
    echo -e "${GREEN}RESULT: PASS — no blocking issues${NC}"
    if [ $WARNS -gt 0 ]; then
        echo -e "${YELLOW}  ($WARNS warning(s) — review manually, may be intentional)${NC}"
    fi
    exit 0
fi
