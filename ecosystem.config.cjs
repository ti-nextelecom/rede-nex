module.exports = {
  apps: [{
    name: 'rede-nex-server',
    script: 'server/src/server.js',
    interpreter: '/home/wendel/.nvm/versions/node/v22.23.1/bin/node',
    cwd: '/opt/rede-nex/deploy_v2',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '512M',
    error_file: '/home/wendel/logs/rede-nex-error.log',
    out_file: '/home/wendel/logs/rede-nex-out.log',
    merge_logs: true,
  }]
};
