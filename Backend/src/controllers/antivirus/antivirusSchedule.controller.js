const Antivirus = require('../../models/antivirus/AntivirusSchedule');

const createAntivirusSchedule = async (req, res) => {
  try {
    const user = req.user?._id || req.user?.id;
    const {
      serviceType,
      preferredDate,
      preferredTime,
      numberOfDevices,
    } = req.body;

    const lastBooking = await Antivirus.findOne({
      ticket_no: { $exists: true, $ne: null },
    }).sort({ createdAt: -1 });

    let nextTicketNo = 1;

    if (lastBooking && lastBooking.ticket_no) {
      nextTicketNo = lastBooking.ticket_no + 1;
    }

    const booking = await Antivirus.create({
      ticket_no: nextTicketNo,
      user,
      serviceType,
      preferredDate,
      preferredTime,
      numberOfDevices,
      createdBy: user
    });

    res.status(201).json({
      success: true,
      message: "Antivirus schedule created successfully",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating antivirus schedule",
      error: error.message,
    });
  }
};

const getAntivirusSchedules = async (req, res) => {
  try{
    const user = req.user?._id || req.user?.id;
    const bookings = await Antivirus.find({ user }).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      message: "Antivirus schedules retrieved successfully",
      data: bookings,
    });
  }catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving antivirus schedules",
      error: error.message,
    });
  }

}

const getAllAntivirusSchedules = async (req, res) => {
  try {
    const bookings = await Antivirus.find()
      .populate('user', 'name email')  // gets user's name & email
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "All antivirus schedules retrieved successfully",
      data: bookings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving all antivirus schedules",
      error: error.message,
    });
  }
};

module.exports = {
  createAntivirusSchedule,
  getAntivirusSchedules,
  getAllAntivirusSchedules,
};
