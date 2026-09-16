/**
 * pm2 process file — no Docker needed.
 *
 * First deploy:
 *   npm ci
 *   npx prisma generate
 *   npx prisma db push
 *   npm run build
 *   npm run sitemap
 *   pm2 start ecosystem.config.js
 *   pm2 save && pm2 startup
 *
 * Later code updates (sitemap does NOT need this — it refreshes itself):
 *   git pull && npm ci && npm run build && pm2 reload all
 */
module.exports = {
  apps: [
    {
      name: "marjane-app",
      cwd: __dirname,
      script: "npm",
      args: "start", // next start -p 3006
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      // AI jobs + article expiry + sitemap refresh (boot + hourly).
      // This is what keeps public/sitemap.xml fresh with no rebuild.
      name: "marjane-worker",
      cwd: __dirname,
      script: "npm",
      args: "run worker", // tsx src/workers/catalogue-worker.ts
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      // Safety net: regenerates public/sitemap.xml hourly even if the
      // worker is down. Direct SQLite access — no Next.js server needed.
      name: "marjane-sitemap",
      cwd: __dirname,
      script: "npm",
      args: "run sitemap", // tsx scripts/generate-sitemap.ts
      instances: 1,
      exec_mode: "fork",
      autorestart: false,
      cron_restart: "7 * * * *", // minute 7 of every hour
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
