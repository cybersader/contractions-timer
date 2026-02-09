#!/bin/bash
# Standalone scanner for personal data in the repository
# Usage: scripts/check-personal-data.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Scanning repository for personal data patterns..."
echo ""

FOUND_ISSUES=0

PATTERNS=(
    'C:\\Users\\'
    'C:/Users/'
    '/Users/'
    '/home/'
    '/mnt/c/Users/'
    '@gmail.com'
    '@yahoo.com'
    '@hotmail.com'
    '@outlook.com'
    'api_key'
    'API_KEY'
    'secret_key'
    'SECRET_KEY'
)

# Scan all tracked files
for pattern in "${PATTERNS[@]}"; do
    MATCHES=$(grep -rn "$pattern" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=knowledge-base --exclude=main.js --exclude=bun.lockb --include="*.ts" --include="*.json" --include="*.md" --include="*.yml" --include="*.yaml" --include="*.css" --include="*.mjs" . 2>/dev/null | grep -v ".githooks/" | grep -v "scripts/check-personal-data.sh" || true)
    if [ -n "$MATCHES" ]; then
        echo -e "${YELLOW}Pattern: ${pattern}${NC}"
        echo "$MATCHES"
        echo ""
        FOUND_ISSUES=1
    fi
done

if [ $FOUND_ISSUES -eq 1 ]; then
    echo -e "${RED}Personal data patterns found! Review the matches above.${NC}"
    exit 1
else
    echo -e "${GREEN}No personal data patterns found. Repository is clean.${NC}"
    exit 0
fi
