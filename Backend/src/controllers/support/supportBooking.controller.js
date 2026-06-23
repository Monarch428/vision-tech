const SupportBooking = require('../../models/support/SupportBooking');
const Subscription = require("../../models/subscription/Subscription");
const { getSupportUsage } = require('../../utils/supportUserHelper');
const systemLogger = require("../../utils/systemLogger");
const sendEmail = require("../../utils/sendEmail");

const createSupportBooking = async (req, res) => {
  try {
    const user = req.user?._id || req.user?.id;
    const { duration, category, priority, description } = req.body;

    const subscription = await Subscription.findOne({
      user,
      status: 'active',
    }).populate('plan');

    if (!subscription) {
      return res.status(400).json({
        success: false,
        message: 'No active subscription found',
      });
    }

    const requestedMinutes = Number(duration);

    const { usedMinutes, allowedMinutes, remainingMinutes, isEnterprise } =
      await getSupportUsage(user, subscription);

    if (!isEnterprise && usedMinutes + requestedMinutes > allowedMinutes) {
      await systemLogger({
        type: "error",
        action: "SUPPORT_BOOKING_LIMIT_EXCEEDED",
        user: req.user?._id,
        userEmail: req.user?.email,
        details: `Support limit exceeded: requested ${requestedMinutes} min, used ${usedMinutes}/${allowedMinutes} min`,
        module: "support-bookings",
        ipAddress: req.ip,
      });

      return res.status(400).json({
        success: false,
        message: 'Support limit exceeded',
      });
    }

    const lastBooking = await SupportBooking.findOne({
      ticket_no: { $exists: true, $ne: null },
    }).sort({ createdAt: -1 });

    const nextTicketNo = lastBooking ? lastBooking.ticket_no + 1 : 1;

    const booking = await SupportBooking.create({
      ticket_no: nextTicketNo,
      user,
      duration: requestedMinutes,
      category,
      priority,
      description,
      createdBy: user,
    });

    await systemLogger({
      type: "success",
      action: "SUPPORT_BOOKING_CREATED",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Support booking created: ticket #${nextTicketNo} — ${requestedMinutes} min, category: ${category}, priority: ${priority}`,
      module: "support-bookings",
      ipAddress: req.ip,
    });

    // Notify admins via email, same pattern as createSupportRequest
    try {
      const config = await SystemConfig.findOne().lean();
      if (config?.notifications?.serviceRequestAlerts) {
        const adminUsers = await User.find({ role: 'admin' }).select('email name').lean();
        for (const admin of adminUsers) {
          await sendEmail({
            to: admin.email,
            subject: `New Support Booking: Ticket #${nextTicketNo}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #16a34a;">New Support Booking Created</h2>
                <p>Hi <strong>${admin.name}</strong>,</p>
                <p>A new support booking has been created with the following details:</p>
                <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
                  <p style="margin: 4px 0;"><strong>Ticket Number:</strong> #${nextTicketNo}</p>
                  <p style="margin: 4px 0;"><strong>Duration:</strong> ${requestedMinutes} min</p>
                  <p style="margin: 4px 0;"><strong>Category:</strong> ${category}</p>
                  <p style="margin: 4px 0;"><strong>Priority:</strong> ${priority}</p>
                  <p style="margin: 4px 0;"><strong>Description:</strong> ${description || '-'}</p>
                  <p style="margin: 4px 0;"><strong>Booked By:</strong> ${req.user?.email || user}</p>
                  <p style="margin: 4px 0;"><strong>Created At:</strong> ${new Date().toLocaleString()}</p>
                </div>
                <p style="color: #6b7280; font-size: 13px;">
                  You can view and manage this booking from the Support Bookings section.
                </p>
                <p>Thanks,<br/><strong>SOLO Support Team</strong></p>
              </div>
            `,
          });
        }
      }
    } catch (emailError) {
      // Don't fail the booking creation if email sending fails — just log it
      await systemLogger({
        type: "error",
        action: "SUPPORT_BOOKING_EMAIL_ERROR",
        user: req.user?._id,
        userEmail: req.user?.email,
        details: `Failed to send admin notification email for booking #${nextTicketNo}: ${emailError.message}`,
        module: "support-bookings",
        ipAddress: req.ip,
      });
    }

    const newUsedMinutes = usedMinutes + requestedMinutes;
    const newRemaining = isEnterprise ? 'Unlimited' : allowedMinutes - newUsedMinutes;

    return res.status(201).json({
      success: true,
      message: 'Support booking created successfully',
      data: booking,
      supportUsage: {
        usedMinutes: newUsedMinutes,
        remainingMinutes: newRemaining,
        allowedMinutes,
      },
    });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "SUPPORT_BOOKING_CREATE_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Failed to create support booking: ${error.message}`,
      module: "support-bookings",
      ipAddress: req.ip,
    });

    return res.status(500).json({
      success: false,
      message: 'Error creating support booking',
      error: error.message,
    });
  }
};

const getSupportBookings = async (req, res) => {
  try {
    const user = req.user?._id || req.user?.id;
    const bookings = await SupportBooking.find({ user }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Support bookings retrieved successfully",
      data: bookings,
    });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "SUPPORT_BOOKINGS_FETCH_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Failed to fetch support bookings: ${error.message}`,
      module: "support-bookings",
      ipAddress: req.ip,
    });

    res.status(500).json({
      success: false,
      message: "Error retrieving support bookings",
      error: error.message,
    });
  }
};

const getAllSupportBookings = async (req, res) => {
  try {
    const bookings = await SupportBooking.find()
      .populate("user", "name email")
      .populate("assigned_user_id", "name")
      .lean();

    res.status(200).json({
      success: true,
      message: "All support bookings retrieved successfully",
      data: bookings,
    });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "ALL_SUPPORT_BOOKINGS_FETCH_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Failed to fetch all support bookings: ${error.message}`,
      module: "support-bookings",
      ipAddress: req.ip,
    });

    res.status(500).json({
      success: false,
      message: "Error retrieving all bookings",
      error: error.message,
    });
  }
};

const assignTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { assigned_user_id, status } = req.body;

    const ticket = await SupportBooking.findByIdAndUpdate(
      ticketId,
      { assigned_user_id, status },
      { new: true }
    )
      .populate("assigned_user_id", "name email")
      .populate("user", "name email");

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    await systemLogger({
      type: "success",
      action: "SUPPORT_BOOKING_ASSIGNED",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Booking ticket #${ticket.ticket_no} assigned to ${ticket.assigned_user_id?.name || assigned_user_id} with status "${status}"`,
      module: "support-bookings",
      ipAddress: req.ip,
    });

    // ✅ Notify the ASSIGNED USER, not the admin who assigned it
    try {
      if (ticket.assigned_user_id?.email) {
        await sendEmail({
          to: ticket.assigned_user_id.email,
          subject: `You've been assigned Booking Ticket #${ticket.ticket_no}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #16a34a;">New Support Booking Assigned to You</h2>
              <p>Hi <strong>${ticket.assigned_user_id.name}</strong>,</p>
              <p>You have been assigned the following support booking:</p>
              <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 4px 0;"><strong>Ticket Number:</strong> #${ticket.ticket_no}</p>
                <p style="margin: 4px 0;"><strong>Duration:</strong> ${ticket.duration} min</p>
                <p style="margin: 4px 0;"><strong>Category:</strong> ${ticket.category}</p>
                <p style="margin: 4px 0;"><strong>Priority:</strong> ${ticket.priority}</p>
                <p style="margin: 4px 0;"><strong>Description:</strong> ${ticket.description || '-'}</p>
                <p style="margin: 4px 0;"><strong>Requested By:</strong> ${ticket.user?.name || "—"}</p>
                <p style="margin: 4px 0;"><strong>Status:</strong>
                  <span style="color: #16a34a; font-weight: bold; text-transform: capitalize;">${status}</span>
                </p>
              </div>
              <p style="color: #6b7280; font-size: 13px;">
                Please review and action this booking from the Support Bookings section.
              </p>
              <p>Thanks,<br/><strong>SOLO Support Team</strong></p>
            </div>
          `,
        });
      }
    } catch (emailError) {
      // Don't fail the assignment if email sending fails — just log it
      await systemLogger({
        type: "error",
        action: "SUPPORT_BOOKING_ASSIGN_EMAIL_ERROR",
        user: req.user?._id,
        userEmail: req.user?.email,
        details: `Booking assigned but failed to email assignee for ticket #${ticket.ticket_no}: ${emailError.message}`,
        module: "support-bookings",
        ipAddress: req.ip,
      });
    }

    res.status(200).json({
      success: true,
      message: "Ticket assigned successfully",
      data: ticket,
    });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "SUPPORT_BOOKING_ASSIGN_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Failed to assign booking ticket ${req.params?.ticketId}: ${error.message}`,
      module: "support-bookings",
      ipAddress: req.ip,
    });

    res.status(500).json({
      success: false,
      message: "Error assigning ticket",
      error: error.message,
    });
  }
};

module.exports = {
  createSupportBooking,
  getSupportBookings,
  getAllSupportBookings,
  assignTicket,
};