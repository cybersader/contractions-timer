#!/bin/bash
# Set up git hooks for this repository
# Run once after cloning: bash scripts/setup-hooks.sh

set -e

echo "Setting up git hooks..."
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
echo "Git hooks configured. Pre-commit hook will scan for personal data."
