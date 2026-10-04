import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

config({ path: path.join(__dirname, '..', '.env') });
config({ path: path.join(__dirname, '..', '.env.local') });

export const env = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_energy',
  jwtSecret: process.env.JWT_SECRET || 'smart-energy-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  mlDir: path.resolve(__dirname, '..', process.env.ML_DIR || '../ml'),
  mlPredictScript: process.env.ML_PREDICT_SCRIPT || 'scripts/predict.py',
  mlPredictOccupancyScript: process.env.ML_PREDICT_OCCUPANCY_SCRIPT || 'scripts/predict_occupancy.py',
  simIntervalMs: Number(process.env.SIM_INTERVAL_MS || 8000),
  simMinutesPerTick: Number(process.env.SIM_MINUTES_PER_TICK || 30),
  voiceProvider: (process.env.VOICE_PROVIDER || 'demo').toLowerCase(),
  exotelSid: process.env.EXOTEL_ACCOUNT_SID || '',
  exotelApiToken: process.env.EXOTEL_API_TOKEN || '',
  exotelFromNumber: process.env.EXOTEL_FROM_NUMBER || '',
  exotelCallerId: process.env.EXOTEL_CALLER_ID || '',
  exotelPublicBaseUrl: (process.env.EXOTEL_PUBLIC_BASE_URL || '').replace(/\/+$/, ''),
  callWebhookUser: process.env.CALLS_WEBHOOK_USER || '',
  callWebhookPass: process.env.CALLS_WEBHOOK_PASS || ''
};

export default env;