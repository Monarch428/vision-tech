const SupportBooking = require('../../models/support/SupportBooking');

const createSupportBooking = async (req, res) => {
  try {
    const user = req.user?._id || req.user?.id;
    const {
      duration,
      category,
      priority,
      description,
    } = req.body;

    const lastBooking = await SupportBooking.findOne({
      ticket_no: { $exists: true, $ne: null },
    }).sort({ createdAt: -1 });

    let nextTicketNo = 1;

    if (lastBooking && lastBooking.ticket_no) {
      nextTicketNo = lastBooking.ticket_no + 1;
    }

    const booking = await SupportBooking.create({
      ticket_no: nextTicketNo,
      user,
      duration,
      category,
      priority,
      description,
      createdBy: user
    });

    res.status(201).json({
      success: true,
      message: "Support booking created successfully",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating support booking",
      error: error.message,
    });
  }
};

const getSupportBookings = async (req, res) => {
  try{
    const user = req.user?._id || req.user?.id;
    const bookings = await SupportBooking.find({ user }).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      message: "Support bookings retrieved successfully",
      data: bookings,
    });
  }catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving support bookings",
      error: error.message,
    });
  }

}

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
    const { assigned_user_id,status  } = req.body;

    const ticket = await SupportBooking.findByIdAndUpdate(  // ✅ SupportBooking, not SupportRequest
      ticketId,
      { assigned_user_id,status },          // ✅ match your schema field name
      { new: true }
    ).populate("assigned_user_id", "name");

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Ticket assigned successfully",
      data: ticket,
    });
  } catch (error) {
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
  assignTicket
};
