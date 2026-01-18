const cloudinary = require("cloudinary").v2;
const User = require("../models/User.model");
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
