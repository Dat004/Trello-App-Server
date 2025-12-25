const Workspace = require('../models/Workspace.model');

// Tạo workspace mới
module.exports.create = async (req, res, next) => {
  try {
    const { name, description, color, visibility, maxMembers } = req.body;

    const newWorkspace = await Workspace.create({
      name,
      description: description || '',
      color: color || 'bg-blue-500',
      visibility: visibility || 'private',
      maxMembers: maxMembers || 10,
      owner: req.user._id,
      members: [{ user: req.user._id, role: 'admin' }],
    });

    res.status(201).json({
      success: true,
      message: 'Tạo workspace thành công',
      data: { workspace: newWorkspace },
    });
  } catch (error) {
    next(error);
  }
};

// Lấy tất cả các workspaces
module.exports.getMyWorkspaces = async (req, res, next) => {
  try {
    const workspaces = await Workspace.find({
      $or: [
        { owner: req.user._id },
        { 'members.user': req.user._id },
      ],
    }).sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Lấy danh sách workspace thành công',
      data: { workspaces },
    });
  } catch (error) {
    next(error);
  }
};
