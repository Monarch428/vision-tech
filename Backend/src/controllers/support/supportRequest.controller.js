const SupportRequest = require("../../models/support/SupportRequest");
const User = require("../../models/auth/User");
const sendEmail = require("../../utils/sendEmail");
const SystemConfig = require('../../models/system-config/SystemConfig');
const systemLogger = require("../../utils/systemLogger");

const createSupportRequest = async (req, res) => {
  try {
    const user = req.user?._id || req.user?.id;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: user not found",
      });
    }

    const { subject, description, priority, category, attachments, duration } = req.body;

    const lastRequest = await SupportRequest.findOne({
      ticketNumber: { $exists: true, $ne: null },
    }).sort({ createdAt: -1 });

    let nextTicketNumber = 1;
    if (lastRequest?.ticketNumber) {
      const match = lastRequest.ticketNumber.match(/\d+$/);
      const lastNum = match ? parseInt(match[0]) : 0;
      nextTicketNumber = lastNum + 1;
    }

    const ticketNumber = `REQ-${nextTicketNumber}`;

    const ticket = await SupportRequest.create({
      user,
      ticketNumber,
      subject,
      description,
      priority,
      category,
      attachments,
      duration: Number(duration) || 0,
      createdBy: user,
    });

    await systemLogger({
      type: "success",
      action: "SUPPORT_REQUEST_CREATED",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Support ticket created: ${ticketNumber} — "${subject}" (priority: ${priority}, category: ${category})`,
      module: "support-requests",
      ipAddress: req.ip,
    });

    const config = await SystemConfig.findOne().lean();
    if (config?.notifications?.serviceRequestAlerts) {
      const adminUsers = await User.find({ role: 'admin' }).select('email name').lean();
      for (const admin of adminUsers) {
        await sendEmail({
          to: admin.email,
          subject: `New Support Ticket: ${ticket.subject}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #16a34a;">New Support Ticket Created</h2>
              <p>Hi <strong>${admin.name}</strong>,</p>
              <p>A new support ticket has been created with the following details:</p>
              <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 4px 0;"><strong>Ticket Number:</strong> ${ticket.ticketNumber}</p>
                <p style="margin: 4px 0;"><strong>Subject:</strong> ${ticket.subject}</p>
                <p style="margin: 4px 0;"><strong>Description:</strong> ${ticket.description}</p>
                <p style="margin: 4px 0;"><strong>Priority:</strong> ${ticket.priority}</p>
                <p style="margin: 4px 0;"><strong>Category:</strong> ${ticket.category}</p>
                <p style="margin: 4px 0;"><strong>Created At:</strong> ${new Date().toLocaleString()}</p>
              </div>
              <p style="color: #6b7280; font-size: 13px;">
                You can view and manage this ticket from the Support Requests section.
              </p>
              <p>Thanks,<br/><strong>SOLO Support Team</strong></p>
            </div>
          `,
        });
      }
    }

    res.status(201).json({
      success: true,
      message: "Support ticket created successfully",
      data: ticket,
    });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "SUPPORT_REQUEST_CREATE_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Failed to create support request: ${error.message}`,
      module: "support-requests",
      ipAddress: req.ip,
    });

    res.status(500).json({
      success: false,
      message: "Error creating support ticket",
      error: error.message,
    });
  }
};

const getSupportRequests = async (req, res) => {
  try {
    const user = req.user?._id || req.user?.id;

    const bookings = await SupportRequest
      .find({ user })
      .populate("user", "name email")
      .populate("assigned_user_id", "name email")
      .lean();

    // Flatten assigned_user_id → assignedTo (display name) so the frontend
    // ticket detail modal can show it directly without a nested lookup.
    const data = bookings.map((b) => ({
      ...b,
      assignedTo: b.assigned_user_id?.name || b.assigned_user_id?.email || null,
    }));

    res.status(200).json({
      success: true,
      message: "Support requests retrieved successfully",
      data,
    });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "SUPPORT_REQUESTS_FETCH_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Failed to fetch support requests: ${error.message}`,
      module: "support-requests",
      ipAddress: req.ip,
    });

    res.status(500).json({
      success: false,
      message: "Error retrieving support requests",
      error: error.message,
    });
  }
};

const assignTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { assigned_user_id, status } = req.body;

    const previous = await SupportRequest.findById(ticketId);
    if (!previous) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    const actorName = req.user?.name || req.user?.email || "System";

    let assigneeName = null;
    if (assigned_user_id && assigned_user_id !== String(previous.assigned_user_id || "")) {
      const assignee = await User.findById(assigned_user_id).select("name email");
      assigneeName = assignee?.name || assignee?.email || "a team member";
    }

    // "Ticket assigned by <actor> to <assignee>" instead of "assigned to X by actor"
    const changeMessages = [];
    if (assigneeName) changeMessages.push(`assigned by ${actorName} to ${assigneeName}`);
    if (status && status !== previous.status) changeMessages.push(`status changed to "${status}" by ${actorName}`);

    const activityEntry = changeMessages.length
      ? {
        message: `Ticket ${changeMessages.join(" and ")}`,
        by: actorName,
        status: status || previous.status,
        createdAt: new Date(),
      }
      : null;

    const update = { assigned_user_id, status };
    if (status === "resolved" || status === "closed") {
      update.resolvedAt = new Date();
    }
    if (activityEntry) {
      update.$push = { activity: activityEntry };
    }

    const ticket = await SupportRequest.findByIdAndUpdate(
      ticketId,
      update,
      { new: true }
    )
      .populate("assigned_user_id", "name email")
      .populate("user", "name email");

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    await systemLogger({
      type: "success",
      action: "SUPPORT_REQUEST_ASSIGNED",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Ticket ${ticket.ticketNumber} assigned to ${ticket.assigned_user_id?.name || assigned_user_id} with status "${status}"`,
      module: "support-requests",
      ipAddress: req.ip,
    });

    // ✅ Notify the ASSIGNED USER, not the admin who assigned it
    try {
      if (ticket.assigned_user_id?.email) {
        await sendEmail({
          to: ticket.assigned_user_id.email,
          subject: `You've been assigned Ticket ${ticket.ticketNumber}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #16a34a;">New Ticket Assigned to You</h2>
              <p>Hi <strong>${ticket.assigned_user_id.name}</strong>,</p>
              <p>You have been assigned the following support ticket:</p>
              <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 4px 0;"><strong>Ticket:</strong> ${ticket.ticketNumber}</p>
                <p style="margin: 4px 0;"><strong>Subject:</strong> ${ticket.subject}</p>
                <p style="margin: 4px 0;"><strong>Description:</strong> ${ticket.description}</p>
                <p style="margin: 4px 0;"><strong>Requested By:</strong> ${ticket.user?.name || "—"}</p>
                <p style="margin: 4px 0;"><strong>Status:</strong>
                  <span style="color: #16a34a; font-weight: bold; text-transform: capitalize;">${status}</span>
                </p>
              </div>
              <p style="color: #6b7280; font-size: 13px;">Please review and action this ticket from the Support Requests section.</p>
              <p>Thanks,<br/><strong>SOLO Support Team</strong></p>
            </div>
          `,
        });
      }
    } catch (emailError) {
      // Don't fail the whole assignment if email fails
      await systemLogger({
        type: "error",
        action: "SUPPORT_REQUEST_ASSIGN_EMAIL_ERROR",
        user: req.user?._id,
        userEmail: req.user?.email,
        details: `Ticket assigned but failed to email assignee: ${emailError.message}`,
        module: "support-requests",
        ipAddress: req.ip,
      });
    }

    res.status(200).json({ success: true, message: "Ticket assigned successfully", data: ticket });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "SUPPORT_REQUEST_ASSIGN_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Failed to assign ticket ${req.params?.ticketId}: ${error.message}`,
      module: "support-requests",
      ipAddress: req.ip,
    });

    res.status(500).json({ success: false, message: "Error assigning ticket", error: error.message });
  }
};

const getAllSupportRequests = async (req, res) => {
  try {
    const bookings = await SupportRequest.find()
      .populate("user", "name email")
      .populate("assigned_user_id", "name")
      .lean();

    const criticalRequest = bookings.filter(
      (request) => request.priority?.toLowerCase() === "high"
    ).length;

    res.status(200).json({
      success: true,
      message: "Support requests retrieved successfully",
      totalRequests: bookings.length,
      criticalRequest,
      data: bookings,
    });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "ALL_SUPPORT_REQUESTS_FETCH_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Failed to fetch all support requests: ${error.message}`,
      module: "support-requests",
      ipAddress: req.ip,
    });

    res.status(500).json({
      success: false,
      message: "Error retrieving support requests",
      error: error.message,
    });
  }
};

const getRecentSupportRequests = async (req, res) => {
  try {
    const bookings = await SupportRequest.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("user", "name email")
      .populate("assigned_user_id", "name")
      .lean();

    res.status(200).json({
      success: true,
      message: "Recent support requests retrieved successfully",
      data: bookings,
    });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "RECENT_SUPPORT_REQUESTS_FETCH_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Failed to fetch recent support requests: ${error.message}`,
      module: "support-requests",
      ipAddress: req.ip,
    });

    res.status(500).json({
      success: false,
      message: "Error retrieving recent support requests",
      error: error.message,
    });
  }
};

module.exports = {
  createSupportRequest,
  getSupportRequests,
  assignTicket,
  getAllSupportRequests,
  getRecentSupportRequests
};