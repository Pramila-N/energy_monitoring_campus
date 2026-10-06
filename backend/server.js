import app from './app.js';
import env from './config/env.js';
import connectDB from './config/database.js';
import { initializeSimulation } from './services/simulationService.js';

function listen() {
  return new Promise((resolve, reject) => {
    const server = app.listen(env.port, () => resolve(server));
    server.once('error', reject);
  });
}

async function main() {
  let server;

  try {
    server = await listen();
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${env.port} is already in use. Stop the existing backend or set a different PORT.`);
      return;
    }
    throw err;
  }

  try {
    await connectDB(env.mongoUri);
    await initializeSimulation();
    console.log(`Smart Energy API running on http://localhost:${env.port}`);
    console.log(`API base: http://localhost:${env.port}/api`);
  } catch (err) {
    server.close();
    throw err;
  }
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});