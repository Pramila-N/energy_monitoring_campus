import asyncHandler from '../utils/asyncHandler.js';
import reportService from '../services/reportService.js';

export const getReports = asyncHandler(async (req, res) => {
  const report = await reportService.buildReport({
    type: req.query.type || 'day',
    from: req.query.from,
    to: req.query.to
  });
  res.json(report);
});

export const exportCSV = asyncHandler(async (req, res) => {
  const report = await reportService.buildReport({
    type: req.query.type || 'day',
    from: req.query.from,
    to: req.query.to
  });
  const csv = reportService.toCSV(report);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="energy-report.csv"');
  res.send(csv);
});

export default { getReports, exportCSV };