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

    const { subject, description, priority, category, attachments } = req.body;

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
      .populate("user", "name email");

    res.status(200).json({
      success: true,
      message: "Support requests retrieved successfully",
      data: bookings,
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

    const loggedInUser = await User.findById(req.user._id || req.user.id).lean();

    const ticket = await SupportRequest.findByIdAndUpdate(
      ticketId,
      { assigned_user_id, status },
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

    if (loggedInUser?.email) {
      await sendEmail({
        to: loggedInUser.email,
        subject: `Ticket ${ticket.ticketNumber} has been assigned`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">Ticket Assignment Confirmation</h2>
            <p>Hi <strong>${loggedInUser.name}</strong>,</p>
            <p>You have successfully assigned the following ticket.</p>
            <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>Ticket:</strong> ${ticket.ticketNumber}</p>
              <p style="margin: 4px 0;"><strong>Description:</strong> ${ticket.description}</p>
              <p style="margin: 4px 0;"><strong>Assigned To:</strong> ${ticket.assigned_user_id?.name || "Support Agent"}</p>
              <p style="margin: 4px 0;"><strong>Status:</strong>
                <span style="color: #16a34a; font-weight: bold; text-transform: capitalize;">${status}</span>
              </p>
            </div>
            <p style="color: #6b7280; font-size: 13px;">This is a confirmation of your action.</p>
            <p>Thanks,<br/><strong>SOLO Support Team</strong></p>
          </div>
        `,
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

module.exports = {
  createSupportRequest,
  getSupportRequests,
  assignTicket,
  getAllSupportRequests,
};