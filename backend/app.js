import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import env from './config/env.js';

const app = express();

app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);
app.get('/', (req, res) => res.json({ service: 'Smart Energy Optimization System API', status: 'running' }));

app.use(notFound);
app.use(errorHandler);

export default app;