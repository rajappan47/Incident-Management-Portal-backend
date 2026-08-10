const activityService = require('../services/activityService');


const getIncidentActivities = async (req, res,next) => {
  try {
    const activities = await activityService.getActivityLogsByIncidentId(req.params.id);
    res.status(200).json(activities);
  } catch (error) {
    next(error)
   // res.status(400).json({ message: error.message });
  }
};

module.exports = { getIncidentActivities };