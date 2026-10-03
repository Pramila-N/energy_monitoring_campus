import { spawn } from 'child_process';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import env from '../config/env.js';

const ML_DIR = env.mlDir;
const MODELS_DIR = path.join(ML_DIR, 'models');
const INFERENCE_SERVER = path.join(ML_DIR, 'scripts', 'inference_server.py');
const REQUEST_TIMEOUT_MS = 60000;

let child = null;
let pending = new Map();
let nextId = 1;
let ready = false;
let restarting = false;

function modelExists(name) {
  return fs.existsSync(path.join(MODELS_DIR, name));
}

export function isEnergyModelReady() {
  return modelExists('energy_model.joblib') && modelExists('energy_pipeline.joblib');
}

export function isOccupancyModelReady() {
  return modelExists('occupancy_model.joblib') && modelExists('occupancy_pipeline.joblib');
}

export function modelStatus() {
  return {
    energy: isEnergyModelReady(),
    occupancy: isOccupancyModelReady(),
    mlDir: ML_DIR
  };
}

function killPending(errorMessage) {
  const items = [...pending.values()];
  pending.clear();
  items.forEach((p) => {
    clearTimeout(p.timer);
    p.reject(new Error(errorMessage));
  });
}

function ensureReady(force = false) {
  if (child && !child.killed && ready && !force) return;
  if (child && !child.killed) return; // waiting for READY already
  spawnServer();
}

function spawnServer() {
  if (restarting) return;
  restarting = true;
  try {
    ready = false;
    child = spawn('python', [INFERENCE_SERVER], {
      cwd: ML_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    child.stdout.setEncoding('utf-8');
    child.stderr.setEncoding('utf-8');

    const rl = readline.createInterface({ input: child.stdout });

    rl.on('line', (line) => {
      line = line.trim();
      if (line === 'READY') {
        ready = true;
        restarting = false;
        return;
      }
      if (!line.startsWith('{')) return;
      try {
        const msg = JSON.parse(line);
        if (msg.id && pending.has(msg.id)) {
          const p = pending.get(msg.id);
          pending.delete(msg.id);
          clearTimeout(p.timer);
          if (msg.error) p.reject(new Error(msg.error));
          else p.resolve(msg);
        }
      } catch {
        /* ignore malformed lines */
      }
    });

    child.stderr.on('data', (d) => {
      const s = String(d).trim();
      if (s && !s.startsWith('[warn]')) console.warn('[ml-server]', s.slice(-500));
    });

    child.on('exit', (code) => {
      restarting = false;
      ready = false;
      const wasAlive = child !== null;
      child = null;
      console.warn(`[ml-server] exited (code ${code})`);
      if (wasAlive) killPending('ML server exited unexpectedly.');
    });

    child.on('error', (err) => {
      child = null;
      restarting = false;
      killPending(`ML server could not start: ${err.message}`);
    });
  } finally {
    // timing: allow single retry path
  }
}

function request(op, records) {
  ensureReady();
  if (!child || child.killed) {
    return Promise.reject(new Error('ML server is not available.'));
  }
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`ML ${op} request timed out.`));
        child.kill();
      }
    }, REQUEST_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ id, op, records }) + '\n');
  });
}

export async function predictEnergyBatch(features) {
  const result = await request('energy', features);
  return { predictions: result.predictions, model_version: result.model_version };
}

export async function predictOccupancyBatch(features) {
  const result = await request('occupancy', features);
  return { predictions: result.predictions, model_version: result.model_version };
}

/** Run occupancy first, then energy using the predicted present occupancy. */
export async function predictAll(features) {
  const result = await request('all', features);
  return result;
}

export function restartServer() {
  if (child) child.kill();
  else spawnServer();
  return { starting: true };
}

export function getEnergyMetrics() {
  const file = path.join(MODELS_DIR, 'metrics.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

export function getOccupancyMetrics() {
  const file = path.join(MODELS_DIR, 'occupancy_metrics.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

export default {
  isEnergyModelReady,
  isOccupancyModelReady,
  modelStatus,
  predictEnergyBatch,
  predictOccupancyBatch,
  predictAll,
  restartServer,
  getEnergyMetrics,
  getOccupancyMetrics
};