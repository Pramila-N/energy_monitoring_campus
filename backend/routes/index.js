import { Router } from 'express';
import protect from '../middleware/auth.js';
import authController from '../controllers/authController.js';
import dashboardController from '../controllers/dashboardController.js';
import buildingController from '../controllers/buildingController.js';
import classroomController from '../controllers/classroomController.js';
import facultyController from '../controllers/facultyController.js';
import energyController from '../controllers/energyController.js';
import predictionController from '../controllers/predictionController.js';
import alertController from '../controllers/alertController.js';
import recommendationController from '../controllers/recommendationController.js';
import applianceController from '../controllers/applianceController.js';
import simulationController from '../controllers/simulationController.js';
import reportController from '../controllers/reportController.js';
import settingsController from '../controllers/settingsController.js';
import callController from '../controllers/callController.js';
import rateLimitCalls from '../middleware/rateLimit.js';

const router = Router();

// Auth
router.post('/auth/login', authController.login);
router.get('/auth/me', protect, authController.me);

// Dashboard
router.get('/dashboard/summary', protect, dashboardController.getSummary);
router.get('/dashboard/insights', protect, dashboardController.getInsights);

// Buildings
router.get('/buildings', protect, buildingController.listBuildings);
router.get('/buildings/:id', protect, buildingController.getBuilding);

// Classrooms
router.get('/classrooms', protect, classroomController.listClassrooms);
router.get('/classrooms/:id', protect, classroomController.getClassroom);

// Faculty
router.get('/faculty', protect, facultyController.listFaculty);
router.get('/faculty/:id', protect, facultyController.getFaculty);
router.post('/faculty/:id/contact', protect, facultyController.contactFaculty);

// Energy
router.get('/energy/readings', protect, energyController.getReadings);
router.get('/energy/:roomId', protect, energyController.getRoomEnergy);
router.get('/energy/:roomId/series', protect, energyController.getEnergySeries);

// Predictions
router.get('/predictions', protect, predictionController.getPredictions);
router.get('/predictions/metrics', protect, predictionController.getMetrics);
router.post('/predictions/generate', protect, predictionController.generatePredictions);
router.get('/ml/status', protect, predictionController.getMLStatus);

// Alerts
router.get('/alerts', protect, alertController.getAlerts);
router.patch('/alerts/:id', protect, alertController.patchAlert);
router.post('/alerts/:id/contact', protect, alertController.contactAlert);
router.post('/alerts/:id/resolve', protect, alertController.resolveAlert);

// Recommendations
router.get('/recommendations', protect, recommendationController.getRecommendations);
router.post('/recommendations/generate', protect, recommendationController.generateRecommendations);
router.post('/recommendations/:roomId/:type/resolve', protect, recommendationController.resolveRecommendation);

// Appliances
router.get('/appliances', protect, applianceController.getAppliances);

// Simulation
router.get('/simulation/status', protect, simulationController.getStatus);
router.post('/simulation/update', protect, simulationController.manualUpdate);
router.post('/simulation/start', protect, simulationController.start);
router.post('/simulation/stop', protect, simulationController.stop);
router.post('/simulation/speed', protect, simulationController.setSpeed);

// Reports
router.get('/reports', protect, reportController.getReports);
router.get('/reports/export.csv', protect, reportController.exportCSV);

// Settings
router.get('/settings', protect, settingsController.getConfig);
router.put('/settings', protect, settingsController.putConfig);

// Faculty calls (real telephony — Exotel) 
router.post('/calls/faculty', protect, rateLimitCalls({ max: 5 }), callController.createCall);
router.get('/calls/status/:classroomId', protect, callController.getStatusForRoom);
router.get('/calls/history', protect, callController.getHistory);
router.get('/calls/:callId/ivr', callController.serveIVR); // public — fetched by Exotel on answer
router.post('/calls/webhook', callController.handleWebhook); // public — Exotel status callbacks

// Health
router.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

export default router;