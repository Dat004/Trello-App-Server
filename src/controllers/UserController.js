module.exports.me = async (req, res, next) => {
    // Kiểm tra nếu người dùng chưa được xác thực
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Không thể lấy thông tin người dùng (chưa xác thực)',
        });
    }

    // Lấy thông tin người dùng từ req.user (qua middleware xác thực JWT)
    res.status(200).json({
        success: true,
        message: 'Lấy thông tin người dùng thành công',
        data: {
            user: req.user,
        },
    });
};
