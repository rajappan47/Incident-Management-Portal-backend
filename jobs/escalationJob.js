// backend/jobs/escalationJob.js
// 🆕 ENTIRE FILE IS NEW
const cron = require('node-cron');
const incidentService = require('../services/incidentService');
const logger = require('../utils/logger');

const startEscalationJob = () => {
  // Runs every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    logger.info('[Escalation Job] Running SLA escalation check...');
    try {
      const result = await incidentService.escalateOverdueIncidents();
      logger.info(`[Escalation Job] Done. Escalated: ${result.escalatedCount}`);
    } catch (err) {
      logger.error(`[Escalation Job] Error: ${err.message}`);
    }
  });

  logger.info('[Escalation Job] Scheduler initialized — running every 15 minutes.');
};

module.exports = startEscalationJob;