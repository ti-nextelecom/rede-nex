module.exports = {
  apps: [{
    name: 'rede-nex-server',
    script: 'server/src/server.js',
    cwd: '/opt/rede-nex/deploy_v2',
    instances: 2,
    exec_mode: 'cluster',
    env_file: '/opt/rede-nex/deploy_v2/.env',
    watch: false,
    max_memory_restart: '512M',
    error_file: '/home/wendel/logs/rede-nex-error.log',
    out_file: '/home/wendel/logs/rede-nex-out.log',
    merge_logs: true,
  }]
};
