#!/usr/bin/env bash
set -euo pipefail
npm ci --omit=dev
npm run api
