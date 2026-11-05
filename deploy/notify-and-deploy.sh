#!/usr/bin/env bash
# notify-and-deploy.sh — alerta usuários antes de executar update.sh
# Uso: ./notify-and-deploy.sh [minutos_de_aviso]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MINUTES="${1:-5}"
API_URL="${REDE_NEX_API_URL:-http://127.0.0.1:3333}"
ADMIN_TOKEN="${REDE_NEX_ADMIN_TOKEN:-}"

if [ -z "$ADMIN_TOKEN" ]; then
  echo "Erro: REDE_NEX_ADMIN_TOKEN nao definido."
  echo "Defina com: export REDE_NEX_ADMIN_TOKEN=<seu-token-de-sessao>"
  exit 1
fi

echo "==> Disparando alerta de manutencao para todos os usuarios (${MINUTES} min)..."
curl -sf -X POST "${API_URL}/api/admin/maintenance-alert" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=${ADMIN_TOKEN}" \
  -d "{\"minutes\": ${MINUTES}, \"message\": \"\"}" \
  && echo " OK" || echo " Falha ao disparar alerta (continuando mesmo assim)"

echo "==> Aguardando ${MINUTES} minuto(s)..."
sleep $(( MINUTES * 60 ))

echo "==> Executando update.sh..."
"${SCRIPT_DIR}/update.sh"
