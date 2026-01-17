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
        ACCESS_TOKEN: process.env.NEMOCREW_ACCESS_TOKEN || "",
        INTEGRATION_ID: process.env.NEMOCREW_INTEGRATION_ID || ""
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
        ACCESS_TOKEN: process.env.PROFIMATIKA_ACCESS_TOKEN || "",
        INTEGRATION_ID: process.env.PROFIMATIKA_INTEGRATION_ID || ""
      }
    }
  ]
};
