const jwt = require('jsonwebtoken');
const { z } = require('zod');
const User = require('../models/User.model');
const { registerSchema, loginSchema } = require('../utils/validationSchemas');

// Tạo JWT
const signToken = (userId) => {
    return jwt.sign(
        { sub: userId },
            process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '7d',
            issuer: 'trello-api',
            algorithm: 'HS256',
        }
    );
};

// Gửi token về client
const sendTokenResponse = (user, statusCode, res) => {
    const token = signToken(user._id);

    res.status(statusCode).json({
        success: true,
        token,
        data: {
            user
        },
    });
}

// Đăng ký người dùng
module.exports.register = async (req, res) => {
    try {
        // Validate dữ liệu đầu vào
        const validatedData = registerSchema.parse(req.body);

        // Kiểm tra email đã tồn tại chưa
        const existingUser = await User.findOne({ email: validatedData.email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email đã được sử dụng',
            });
        }

        // Tạo người dùng mới
        const newUser = new User({
            ...validatedData,
            providers: ['password'], // Bời vì đây là đăng ký bằng email/password - Mặc định là 'password'
        });
        await newUser.save();

        // Gửi token về client
        sendTokenResponse(newUser, 201, res);
    }
    catch(error) {
        if(error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: error.issues.map(e => e.message).join(', '),
            });
        }

        res.status(500).json({
            success: false,
            message: 'Đăng ký thất bại, vui lòng thử lại',
        });
    }
}

// Đăng nhập người dùng
module.exports.login = async (req, res) => {
    try {
        // Validate dữ liệu đầu vào
        const validationData = loginSchema.parse(req.body);
        // Tìm người dùng theo email
        const user = await User.findOne({ email: validationData.email }).select('+password');
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Email hoặc mật khẩu không đúng',
            });
        }

        // So sánh mật khẩu
        const isMatch = await user.comparePassword(validationData.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Email hoặc mật khẩu không đúng',
            });
        }

        // Cập nhật last_logged
        user.last_logged = Date.now();
        await user.save({
            validateBeforeSave: false,
        });

        // Gửi token về client
        sendTokenResponse(user, 200, res);
    }
    catch (error) {
        if(error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: error.issues.map(e => e.message).join(', '),
            });
        }

        res.status(500).json({
            success: false,
            message: 'Đăng nhập thất bại',
        });
    }
}
