#!/usr/bin/env bash
# Run from the EXTRACTED release, as the same non-root user that owns PM2/app.
set -Eeuo pipefail
umask 077
fail() { printf '%s\n' "$*" >&2; return 1; }
[[ $# -eq 2 ]] || fail 'Uso: bash deploy/update.sh /pasta/atual/app /pasta/privada/backups'
[[ "$1" = /* && "$2" = /* && "$1" != / && "$2" != / ]] || fail 'Use caminhos absolutos específicos; nunca /'
source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
target="$(cd -- "$1" && pwd -P)"
[[ "$target" != "$source_dir" && "$target" != "$HOME" ]] || fail 'Extraia o pacote fora da aplicação/home'
[[ "$target" != / && "$source_dir" != "$target/"* && "$target" != "$source_dir/"* ]] || fail 'Aplicação e pacote precisam ser diretórios separados, não aninhados'
for tool in node npm pm2 pg_dump pg_restore curl flock stat; do command -v "$tool" >/dev/null || fail "Ferramenta ausente: $tool"; done
[[ -f "$target/package.json" && -f "$target/server/src/server.js" ]] || fail 'Destino não é uma instalação existente'
node -e 'if(JSON.parse(require("fs").readFileSync(process.argv[1])).name!=="rede-nex")process.exit(1)' "$target/package.json"
mkdir -p -- "$2"
backup_root="$(cd -- "$2" && pwd -P)"
[[ "$backup_root" != / && "$backup_root" != "$HOME" ]] || fail 'Escolha uma subpasta privada específica para backups'
[[ "$backup_root" != "$target" && "$backup_root" != "$target/"* && "$backup_root" != "$source_dir" && "$backup_root" != "$source_dir/"* ]] || fail 'Backups precisam ficar fora do app/pacote'
target_device="$(stat -c %d -- "$target")"
[[ "$(stat -c %d -- "$source_dir")" = "$target_device" && "$(stat -c %d -- "$backup_root")" = "$target_device" ]] || fail 'App, pacote extraído e backup de rollback precisam estar no mesmo filesystem para renomeação segura'
export NODE_ENV=production
export REDE_NEX_ENV_FILE="${REDE_NEX_ENV_FILE:-$target/.env}"
[[ "$REDE_NEX_ENV_FILE" = /* && -f "$REDE_NEX_ENV_FILE" ]] || fail 'Arquivo de ambiente exclusivo ausente; revise o guia'
export REDE_NEX_PM2_NAME="${REDE_NEX_PM2_NAME:-rede-nex-server}"
exec 9>"$target/.rede-nex-update.lock"
flock -n 9 || fail 'Outra atualização está em andamento'
node "$source_dir/deploy/verify-release.mjs" "$source_dir"
node "$source_dir/deploy/prepare-static-assets.mjs" "$source_dir" "$target"
node "$source_dir/deploy/verify-release.mjs" "$source_dir"
release_id="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).release)' "$source_dir/release-manifest.json")"
node "$source_dir/deploy/check-pm2.mjs" "$target" "$REDE_NEX_PM2_NAME"
(cd -- "$source_dir" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund)
cd -- "$target"
node "$source_dir/server/scripts/deploy-check.mjs" --before-migrations
run_backup="$(mktemp -d "$backup_root/update-XXXXXXXX")"
mkdir -- "$run_backup/code" "$run_backup/failed-code"
cp -- "$REDE_NEX_ENV_FILE" "$run_backup/config.env"
managed=(dist server/src server/agents server/migrations server/scripts shared package.json package-lock.json ecosystem.config.cjs release-manifest.json node_modules)
for path in "${managed[@]}"; do
  [[ ! -L "$target/$path" && -e "$source_dir/$path" ]] || fail "Caminho gerenciado inválido: $path"
  [[ "$(stat -c %d -- "$source_dir/$path")" = "$target_device" ]] || fail "Release com subvolume incompatível: $path"
  if [[ -e "$target/$path" ]]; then [[ "$(stat -c %d -- "$target/$path")" = "$target_device" ]] || fail "Destino com subvolume incompatível: $path"; fi
done
[[ ! -L "$target/server" ]] || fail 'server/ não pode ser um symlink'
moved=(); installed=(); stopped=0
rollback() {
  code=$?; [[ "$code" != 0 ]] || code=1
  trap - ERR INT TERM
  printf 'Atualização interrompida. Tentando restaurar código anterior; backup: %s\n' "$run_backup" >&2
  for path in "${installed[@]}"; do
    mkdir -p -- "$run_backup/failed-code/$(dirname -- "$path")"
    if [[ -e "$target/$path" ]]; then mv -- "$target/$path" "$run_backup/failed-code/$path" || true; fi
  done
  for path in "${moved[@]}"; do
    if [[ -e "$run_backup/code/$path" && ! -e "$target/$path" ]]; then mv -- "$run_backup/code/$path" "$target/$path" || true; fi
  done
  if [[ "$stopped" = 1 ]]; then pm2 restart "$REDE_NEX_PM2_NAME" --update-env || true; fi
  printf '%s\n' 'O banco não foi restaurado automaticamente. Migrações aditivas já confirmadas permanecem.' >&2
  exit "${code:-1}"
}
trap rollback ERR INT TERM
stopped=1
pm2 stop "$REDE_NEX_PM2_NAME"
node "$source_dir/server/scripts/backup.mjs" "$run_backup"
node "$source_dir/server/scripts/migrate.mjs" --apply
node "$source_dir/server/scripts/deploy-check.mjs"
for path in "${managed[@]}"; do
  mkdir -p -- "$target/$(dirname -- "$path")" "$run_backup/code/$(dirname -- "$path")"
  if [[ -e "$target/$path" ]]; then moved+=("$path"); mv -- "$target/$path" "$run_backup/code/$path"; fi
  installed+=("$path")
  mv -- "$source_dir/$path" "$target/$path"
done
pm2 startOrReload "$target/ecosystem.config.cjs" --update-env
# PORT is read by the same env loader; no shell sourcing of the .env file.
health_url="$(node --input-type=module -e 'await import("./server/src/env.js");console.log("http://127.0.0.1:"+(process.env.PORT||3333)+"/api/health")')"
healthy=0
for attempt in {1..20}; do
  if curl --fail --silent --max-time 3 "$health_url" | node --input-type=module -e 'let s="";for await(const c of process.stdin)s+=c;try{const r=JSON.parse(s);if(r.status!=="ok"||r.release!==process.argv[1])process.exit(1)}catch{process.exit(1)}' "$release_id"; then healthy=1; break; fi
  sleep 1
done
[[ "$healthy" = 1 ]] || fail 'API não passou no teste de saúde'
pm2 save
trap - ERR INT TERM
printf 'Atualização concluída. Código/banco/config anteriores guardados em: %s\n' "$run_backup"
printf '%s\n' 'Valide no domínio: login, fotos, chat, tarefas, projetos, agenda e RH. .env e uploads não foram substituídos.'
