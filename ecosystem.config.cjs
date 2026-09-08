module.exports = {
  apps: [
    {
      name: 'odak',
      script: './server/index.mjs',
      env: {
        PORT: 80,
        HOST: '0.0.0.0',
        NODE_ENV: 'production'
      }
    }
  ]
};
