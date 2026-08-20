const rcaService = require('../services/rcaService');

// POST /api/incidents/:id/rca
const createRCA = async (req, res, next) => {
  try {
    const {
      category,
      fiveWhys, // 🆕 FR3-04 — Guided 5-Whys template
      description,
      contributingFactors,
      correctiveActions,
      preventiveActions,
    } = req.body;

    const rca = await rcaService.createRCA({
      incidentId: req.params.id,
      category,
      fiveWhys,
      description,
      contributingFactors,
      correctiveActions,
      preventiveActions,
      user: req.user,
    });

    res.status(201).json({
      message: 'RCA record created successfully',
      rca,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/incidents/:id/rca
const getRCAByIncident = async (req, res, next) => {
  try {
    const rca = await rcaService.getRCAByIncidentId(req.params.id, req.user);
    res.status(200).json(rca);
  } catch (error) {
    next(error);
  }
};

// 🆕 FR3-02 — PUT /api/incidents/:id/rca (edit while Draft)
const updateRCA = async (req, res, next) => {
  try {
    const {
      category,
      fiveWhys, // 🆕 FR3-04
      description,
      contributingFactors,
      correctiveActions,
      preventiveActions,
    } = req.body;

    const rca = await rcaService.updateRCADraft(
      req.params.id,
      { category, fiveWhys, description, contributingFactors, correctiveActions, preventiveActions },
      req.user
    );

    res.status(200).json({
      message: 'RCA draft updated successfully',
      rca,
    });
  } catch (error) {
    next(error);
  }
};

// 🆕 FR3-02 — PATCH /api/incidents/:id/rca/submit (Draft -> In Review)
const submitRCA = async (req, res, next) => {
  try {
    const rca = await rcaService.submitForReview(req.params.id, req.user);
    res.status(200).json({
      message: 'RCA submitted for review',
      rca,
    });
  } catch (error) {
    next(error);
  }
};

// 🆕 FR3-02 / FR3-05 — PATCH /api/incidents/:id/rca/approve (In Review -> Approved)
const approveRCA = async (req, res, next) => {
  try {
    const rca = await rcaService.approveRCA(req.params.id, req.user);
    res.status(200).json({
      message: 'RCA approved',
      rca,
    });
  } catch (error) {
    next(error);
  }
};

// 🆕 FR3-02 / FR3-05 — PATCH /api/incidents/:id/rca/reject (In Review -> Draft, with comments)
const rejectRCA = async (req, res, next) => {
  try {
    const { comments } = req.body;
    const rca = await rcaService.rejectRCA(req.params.id, comments, req.user);
    res.status(200).json({
      message: 'RCA sent back for revision',
      rca,
    });
  } catch (error) {
    next(error);
  }
};

// 🩹 One-time repair — GET /api/incidents/maintenance/fix-rca-links (Admin only)
const repairRCALinks = async (req, res, next) => {
  try {
    const result = await rcaService.repairRCALinks();
    res.status(200).json({
      message: `Checked ${result.totalRCAs} RCA record(s), fixed ${result.fixedCount} broken link(s).`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// 🆕 V3 — FR3-06: POST /api/incidents/:id/rca/attachments (multipart/form-data)
const uploadRCAAttachment = async (req, res, next) => {
  try {
    const attachment = await rcaService.addRCAAttachment(req.params.id, req.file, req.user);
    res.status(201).json({
      message: 'Evidence attached successfully',
      attachment,
    });
  } catch (error) {
    next(error);
  }
};
 
// 🆕 V3 — FR3-06: GET /api/incidents/:id/rca/attachments
async function getRCAAttachments(req, res, next) {
  try {
    const attachments = await rcaService.getRCAAttachments(req.params.id, req.user);
    res.status(200).json(attachments);
  } catch (error) {
    next(error);
  }
}
 
// 🆕 V3 — FR3-06: DELETE /api/incidents/:id/rca/attachments/:attachmentId
const deleteRCAAttachment = async (req, res, next) => {
  try {
    await rcaService.deleteRCAAttachment(req.params.id, req.params.attachmentId, req.user);
    res.status(200).json({ message: 'Evidence removed successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRCA,
  getRCAByIncident,
  updateRCA,
  submitRCA,
  approveRCA,
  rejectRCA,
  repairRCALinks,
  uploadRCAAttachment,
  getRCAAttachments,
  deleteRCAAttachment,

};

