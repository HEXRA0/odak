module.exports = {
  apps: [
    {
      name: 'odak',
      script: './server/index.mjs',
      env: {
        PORT: 4173,
        HOST: '0.0.0.0',
        NODE_ENV: 'production'
      }
    }
  ]
};
