const cloudinary = require("cloudinary").v2;
const User = require("../models/User.model");
const Card = require("../models/Card.model");
const Board = require("../models/Board.model");
const Workspace = require("../models/Workspace.model");
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

module.exports.getMembershipDirectory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const workspaces = await Workspace.find({
      deleted_at: null,
      $or: [{ owner: userId }, { "members.user": userId }],
    })
      .select("name color owner members")
      .populate("owner", "_id full_name email avatar")
      .populate("members.user", "_id full_name email avatar")
      .sort({ name: 1 })
      .lean();

    const workspaceIds = workspaces.map((workspace) => workspace._id);
    const boards = await Board.find({
      workspace: { $in: workspaceIds },
      deleted_at: null,
      archived: false,
    })
      .select("workspace owner members.user")
      .lean();

    const boardCounts = new Map();
    boards.forEach((board) => {
      const memberIds = new Set([
        String(board.owner),
        ...board.members.map((member) => String(member.user)),
      ]);
      memberIds.forEach((memberId) => {
        const key = `${board.workspace}:${memberId}`;
        boardCounts.set(key, (boardCounts.get(key) || 0) + 1);
      });
    });

    const directory = workspaces.map((workspace) => {
      const membersById = new Map();
      if (workspace.owner) {
        membersById.set(String(workspace.owner._id), {
          user: workspace.owner,
          role: "owner",
          joinedAt: null,
        });
      }
      workspace.members.forEach((membership) => {
        if (!membership.user) return;
        const memberId = String(membership.user._id);
        if (membersById.get(memberId)?.role === "owner") return;
        membersById.set(memberId, membership);
      });

      return {
        _id: workspace._id,
        name: workspace.name,
        color: workspace.color,
        members: Array.from(membersById.values()).map((membership) => ({
          _id: membership.user._id,
          full_name: membership.user.full_name,
          email: membership.user.email,
          avatar: membership.user.avatar,
          role: membership.role,
          joinedAt: membership.joinedAt,
          boardsCount:
            boardCounts.get(`${workspace._id}:${membership.user._id}`) || 0,
        })),
      };
    });

    res.status(200).json({
      success: true,
      message: "Lấy directory thành viên thành công",
      data: { workspaces: directory },
    });
  } catch (error) {
    next(error);
  }
};
