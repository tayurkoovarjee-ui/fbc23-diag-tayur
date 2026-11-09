import { createApp } from './app';
import { connectSqlRepo, dbConfigFromEnv } from './sqlRepo';

async function main() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 16) {
    throw new Error('Set JWT_SECRET to a random string of at least 16 characters');
  }
  if (!process.env.DB_PASSWORD) {
    throw new Error('Set DB_PASSWORD (see .env.example)');
  }

  const repo = await connectSqlRepo(dbConfigFromEnv());
  const app = createApp(repo, {
    jwtSecret,
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  });

  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
