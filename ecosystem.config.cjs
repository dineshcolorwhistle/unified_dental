module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME || 'unified-dental-platform',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 7700,
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 7600,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 7700,
      },
    },
  ],
};
