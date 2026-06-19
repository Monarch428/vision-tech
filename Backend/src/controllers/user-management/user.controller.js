const bcrypt = require('bcryptjs');
const User = require('../../models/user-management/User');
const SystemConfig = require('../../models/system-config/SystemConfig')
const Sub = require('../../models/subscription/Subscription');
const Plan = require('../../models/subscription/Plan');
const { formatLastLogin } = require('../../utils/timeFormatter');
const sendEmail = require('../../utils/sendEmail');

// Create User
const createUser = async (req, res) => {
  try {

    const { name, email, password, role, status, avatar } = req.body;

    const existingUser = await User.findOne({ email });

    if (role === 'support') {
      const existingSUpport = await User.findOne({ role: 'support' });
      if (existingSUpport) {
        return res.status(400).json({
          success: false,
          message: 'Only one support user is allowed',
        });
      }
    }

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email',
      });
    }

    const config = await SystemConfig.findOne().lean();

    const minimumPasswordLength = config?.general?.minimumPasswordLength || 8;

    if (password.length < minimumPasswordLength) {
      return res.status(400).json({ message: `Password must be at least ${minimumPasswordLength} characters long` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    //creating user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      isActive: status === 'inactive' ? false : true,
      avatar: avatar || '',
      plan: 'free',
    });

    //get freeplan

    const freePlan = await Plan.findOne({ name: /free/i });

    if (!freePlan) {
      throw new Error('Free plan not found. Please ensure a Free plan exists in the database.');
    }
    //Generate unique subscription ID

    const last_sub = await Sub.findOne({ sub_id: { $exists: true, $ne: null } }).sort({ createdAt: -1 });

    let nextSubId = 'SUB-001';
    if (last_sub && last_sub.sub_id) {
      const lastNumber = parseInt(last_sub.sub_id.split('-')[1], 10);
      nextSubId = `SUB-${String(lastNumber + 1).padStart(3, '0')}`;
    }

    //creating subscription for free plan
    const now = new Date();
    const nextRenewal = new Date();
    nextRenewal.setFullYear(nextRenewal.getFullYear() + 100); // free plan

    const subscription = await Sub.create({
      sub_id: nextSubId,
      user: user._id,
      plan: freePlan._id,
      amount: 0,
      status: 'active',
      startDate: now,
      nextRenewalDate: nextRenewal,
    });

    user.sub_id = subscription.sub_id;
    user.plan = freePlan.name;
    await user.save();

    const newUser = await User.findById(user._id).select('-password');

    if (config?.notifications?.newUserRegistration) {

      const adminUsers = await User.find({ role: 'admin' }).select('email name').lean();

      for (const admin of adminUsers) {
        await sendEmail({
          to: admin.email,
          subject: `New User Registered — ${newUser.name}`,
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">New User Created</h2>
            <p>Hi <strong>${admin.name}</strong>,</p>
            <p>A new user has been added to the platform.</p>

            <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>Name:</strong> ${newUser.name}</p>
              <p style="margin: 4px 0;"><strong>Email:</strong> ${newUser.email}</p>
              <p style="margin: 4px 0;"><strong>Role:</strong> ${newUser.role}</p>
              <p style="margin: 4px 0;"><strong>Status:</strong> ${newUser.status}</p>
              <p style="margin: 4px 0;"><strong>Created At:</strong> ${new Date().toLocaleString()}</p>
            </div>

            <p style="color: #6b7280; font-size: 13px;">
              You can manage this user from the User Management section.
            </p>
            <p>Thanks,<br/><strong>SOLO Support Team</strong></p>
          </div>
        `,
        });
      }

    }

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: newUser,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error.message,
    });
  }
};

// Get All Users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    const now = new Date();

    const currentMonthUsers = users.filter((user) => {
      const createdAt = new Date(user.createdAt);

      return (
        createdAt.getMonth() === now.getMonth() &&
        createdAt.getFullYear() === now.getFullYear()
      );
    }).length;

    const userWithSubscription = await Promise.all(
      users.map(async (user) => {
        const subscription = await Sub.findOne({ user: user._id })
          .populate("plan", "name")
          .lean();

        return {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          subscription: user.deletedAt
            ? "N/A"
            : subscription?.plan?.name || "Free",
          status: user.isActive ? "active" : "deactivated",
          isActive: user.isActive,
          lastLogin: user.lastLogin ?? null,
          lastLoginText: formatLastLogin(user.lastLogin),
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: userWithSubscription.length,
      currentMonthCount: currentMonthUsers,
      data: userWithSubscription,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message,
    });
  }
};
// Get User By ID
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message,
    });
  }
};

// Update User
const updateUser = async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    const updateData = { ...rest };

    // Check if trying to assign support role to another user
    if (rest.role === 'support') {
      const existingSupport = await User.findOne({ role: 'support', _id: { $ne: req.params.id } });
      if (existingSupport) {
        return res.status(400).json({
          success: false,
          message: 'Only one support user is allowed',
        });
      }
    }

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message,
    });
  }
};

// Delete User
const deleteUser = async (req, res) => {
  try {
    const { action } = req.query;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    //if actions -> permanant delete

    if (action === 'delete') {
      await Sub.deleteMany({ user: user._id });
      await User.findByIdAndDelete(user._id);

      return res.status(200).json({
        sucess: true,
        message: 'User and subscription deleted successfully',
      });
    }

    // If active → deactivate
    if (user.isActive) {
      user.deletedAt = new Date();
      user.isActive = false;

      if (user.sub_id) {
        await Sub.findOneAndUpdate(
          { sub_id: user.sub_id },
          {
            status: 'paused',
            pausedAt: new Date(),
          }
        );
      }

      await user.save();

      return res.status(200).json({
        success: true,
        message: 'User deactivated successfully',
      });
    }

    // If inactive → activate
    user.deletedAt = null;
    user.isActive = true;

    if (user.sub_id) {
      await Sub.findOneAndUpdate(
        { sub_id: user.sub_id },
        {
          status: 'active',
          pausedAt: null,
        }
      );
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'User activated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating user status',
      error: error.message,
    });
  }
};

const getUserSB = async (req, res) => {
  try {
    const users = await User.find()
      .select('name role')
      .lean();

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.log("❌ ERROR:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getUserRole = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('role');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: { role: user.role },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user role',
      error: error.message,
    });
  }
};

module.exports = { createUser, getAllUsers, getUserById, updateUser, deleteUser, getUserSB, getUserRole };