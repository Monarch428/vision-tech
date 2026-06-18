const SupportBooking = require('../../models/support/SupportBooking');
const Subscription = require("../../models/subscription/Subscription");
const { getSupportUsage } = require('../../utils/supportUserHelper');
const systemLogger = require("../../utils/systemLogger");

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
      .populate('user', 'name email')
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
    ).populate("assigned_user_id", "name");

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