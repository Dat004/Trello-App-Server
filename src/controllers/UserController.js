const cloudinary = require("cloudinary").v2;
const User = require("../models/User.model");
const Card = require("../models/Card.model");
const {
  updateInfoSchema,
  updateSettingsSchema,
} = require("../utils/validationSchemas");

module.exports.me = async (req, res, next) => {
  // Kiểm tra nếu người dùng chưa được xác thực
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Không thể lấy thông tin người dùng (chưa xác thực)",
    });
  }

  // Lấy thông tin người dùng từ req.user (qua middleware xác thực JWT)
  res.status(200).json({
    success: true,
    message: "Lấy thông tin người dùng thành công",
    data: {
      user: req.user,
    },
  });
};

module.exports.updateInfo = async (req, res, next) => {
  try {
    // Validate dữ liệu đầu vào
    const validatedData = updateInfoSchema.parse(req.body);
    const user = req.user;

    if (
      validatedData.avatar.public_id &&
      user.avatar.url !== validatedData.avatar.url
    ) {
      cloudinary.uploader.destroy(user.avatar.public_id);
    }

    // Cập nhật thông tin người dùng
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: validatedData },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Cập nhật thông tin người dùng thành công",
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports.updateSettings = async (req, res, next) => {
  try {
    // Validate dữ liệu đầu vào
    const validatedData = updateSettingsSchema.parse(req.body);

    // Cập nhật cài đặt người dùng
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          settings: { ...req.user.settings.toObject(), ...validatedData },
        },
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Cập nhật cài đặt người dùng thành công",
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

module.exports.getMyTasks = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { status, filter: taskFilter = "pending", sort = 'due_date' } = req.query;

    const filter = {
      members: userId,
      deleted_at: null,
    };

    if (taskFilter === 'pending') {
      filter.due_complete = { $ne: true };
    } else if (taskFilter === 'completed') {
      filter.due_complete = true;
    }

    if (status === 'has_due') {
      filter.due_date = { $ne: null };
    }

    let sortOptions = {};
    if (sort === 'due_date') {
      sortOptions.due_date = 1; // Sắp xếp deadline gần nhất lên đầu
    } else {
      sortOptions.created_at = -1; // Sắp xếp tạo mới nhất
    }

    const cards = await Card.find(filter)
      .sort(sortOptions)
      .populate('board', 'title type')
      .populate('workspace', 'title name')
      .populate('list', 'title pos')
      .populate('members', '_id full_name avatar username email')
      .lean();

    // Trả thêm trường is_overdue để xử lý trạng thái quá hạn
    const taskData = cards.map(c => {
      let isOverdue = false;
      if (c.due_date) {
        isOverdue = new Date(c.due_date) < new Date();
      }
      return {
        ...c,
        is_overdue: isOverdue,
      };
    });

    res.status(200).json({
      success: true,
      message: "Lấy danh sách công việc thành công",
      data: {
        tasks: taskData,
      },
    });
  } catch (error) {
    next(error);
  }
};
