import app from './app.js';
import env from './config/env.js';
import connectDB from './config/database.js';
import { initializeSimulation } from './services/simulationService.js';

async function main() {
  await connectDB(env.mongoUri);
  await initializeSimulation();
  app.listen(env.port, () => {
    console.log(`Smart Energy API running on http://localhost:${env.port}`);
    console.log(`API base: http://localhost:${env.port}/api`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});