const UserFavorites = require("../models/UserFavorites.model");
const Workspace = require("../models/Workspace.model");
const Board = require("../models/Board.model");

// Toggle star workspace
const toggleStarWorkspace = async (req, res, next) => {
    try {
        const { workspaceId } = req.params;
        const userId = req.user._id;

        // Kiểm tra workspace có tồn tại không
        const workspace = await Workspace.findOne({
            _id: workspaceId,
            deleted_at: null,
        });

        if (!workspace) {
            return res.status(404).json({
                success: false,
                message: "Workspace không tồn tại",
            });
        }

        // Tìm hoặc tạo document favorites của user
        let favorites = await UserFavorites.findOne({ user: userId });

        if (!favorites) {
            favorites = await UserFavorites.create({
                user: userId,
                starred_workspaces: [workspaceId],
                starred_boards: [],
            });

            return res.status(200).json({
                success: true,
                message: "Đã thêm workspace vào yêu thích",
                data: { is_starred: true },
            });
        }

        // Kiểm tra xem đã star chưa
        const isStarred = favorites.starred_workspaces.some(
            (id) => id.toString() === workspaceId
        );

        if (isStarred) {
            // Unstar: remove khỏi array
            favorites.starred_workspaces = favorites.starred_workspaces.filter(
                (id) => id.toString() !== workspaceId
            );
            await favorites.save();

            return res.status(200).json({
                success: true,
                message: "Đã bỏ workspace khỏi yêu thích",
                data: { is_starred: false },
            });
        } else {
            // Star: thêm vào array
            favorites.starred_workspaces.push(workspaceId);
            await favorites.save();

            return res.status(200).json({
                success: true,
                message: "Đã thêm workspace vào yêu thích",
                data: { is_starred: true },
            });
        }
    } catch (error) {
        next(error);
    }
};

// Toggle star board
const toggleStarBoard = async (req, res, next) => {
    try {
        const { boardId } = req.params;
        const userId = req.user._id;

        // Kiểm tra board có tồn tại không
        const board = await Board.findOne({
            _id: boardId,
            deleted_at: null,
        });

        if (!board) {
            return res.status(404).json({
                success: false,
                message: "Board không tồn tại",
            });
        }

        // Tìm hoặc tạo document favorites của user
        let favorites = await UserFavorites.findOne({ user: userId });

        if (!favorites) {
            favorites = await UserFavorites.create({
                user: userId,
                starred_workspaces: [],
                starred_boards: [boardId],
            });

            return res.status(200).json({
                success: true,
                message: "Đã thêm board vào yêu thích",
                data: { is_starred: true },
            });
        }

        // Kiểm tra xem đã star chưa
        const isStarred = favorites.starred_boards.some(
            (id) => id.toString() === boardId
        );

        if (isStarred) {
            // Unstar: remove khỏi array
            favorites.starred_boards = favorites.starred_boards.filter(
                (id) => id.toString() !== boardId
            );
            await favorites.save();

            return res.status(200).json({
                success: true,
                message: "Đã bỏ board khỏi yêu thích",
                data: { is_starred: false },
            });
        } else {
            // Star: thêm vào array
            favorites.starred_boards.push(boardId);
            await favorites.save();

            return res.status(200).json({
                success: true,
                message: "Đã thêm board vào yêu thích",
                data: { is_starred: true },
            });
        }
    } catch (error) {
        next(error);
    }
};

// Get user's favorites
const getMyFavorites = async (req, res, next) => {
    try {
        const userId = req.user._id;

        const favorites = await UserFavorites.findOne({ user: userId })
            .populate("starred_workspaces", "name description color")
            .populate("starred_boards", "title description color workspace");

        if (!favorites) {
            return res.status(200).json({
                success: true,
                data: {
                    starred_workspaces: [],
                    starred_boards: [],
                },
            });
        }

        res.status(200).json({
            success: true,
            data: {
                starred_workspaces: favorites.starred_workspaces,
                starred_boards: favorites.starred_boards,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    toggleStarWorkspace,
    toggleStarBoard,
    getMyFavorites,
};
