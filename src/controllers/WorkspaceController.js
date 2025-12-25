const Workspace = require('../models/Workspace.model');
const { updateWorkspaceSchema } = require('../utils/validationSchemas');

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


// GET tất cả thành viên trong workspace
module.exports.getWorkspaceMembers = async (req, res, next) => {
  try {
    const workspace = req.workspace;

    res.status(200).json({
      success: true,
      message: 'Lấy danh sách thành viên thành công',
      data: {
        members: workspace.members,
        owner: workspace.owner,
      },
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE thông tin workspace (name, description, color, visibility, maxMembers)
module.exports.updateWorkspace = async (req, res, next) => {
  try {
    const validatedData = updateWorkspaceSchema.parse(req.body);

    const updatedWorkspace = await Workspace.findByIdAndUpdate(
      req.params.workspaceId,
      { $set: validatedData },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Cập nhật workspace thành công',
      data: { workspace: updatedWorkspace },
    });
  } catch (error) {
    next(error);
  }
};