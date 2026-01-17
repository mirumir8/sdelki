// Читаем .env файл вручную
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envConfig = {};

if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    line = line.trim();
    // Пропускаем комментарии и пустые строки
    if (!line || line.startsWith('#')) return;

    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();
    if (key && value) {
      envConfig[key.trim()] = value;
    }
  });
}

module.exports = {
  apps: [
    // Аккаунт 1: nemocrew
    {
      name: "sdelki-nemocrew",
      script: "server.js",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
        SUBDOMAIN: "nemocrew",
        ACCESS_TOKEN: envConfig.NEMOCREW_ACCESS_TOKEN || "",
        INTEGRATION_ID: envConfig.NEMOCREW_INTEGRATION_ID || ""
      }
    },

    // Аккаунт 2: profimatika
    {
      name: "sdelki-profimatika",
      script: "server.js",
      env: {
        NODE_ENV: "production",
        PORT: 3002,
        SUBDOMAIN: "profimatika",
        ACCESS_TOKEN: envConfig.PROFIMATIKA_ACCESS_TOKEN || "",
        INTEGRATION_ID: envConfig.PROFIMATIKA_INTEGRATION_ID || ""
      }
    }
  ]
};
