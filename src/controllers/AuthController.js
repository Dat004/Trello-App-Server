const jwt = require('jsonwebtoken');
const { z } = require('zod');

const User = require('../models/User.model');
const errorHandler = require('../middlewares/errorMiddleware');
const { registerSchema, loginSchema } = require('../utils/validationSchemas');

// Tạo JWT
const signToken = (userId) => {
    return jwt.sign(
        {
            sub: userId
        },
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

    // Set httpOnly cookie
    const cookieOptions = {
        expires: new Date(Date.now() + (process.env.JWT_EXPIRES_IN.split('d')[0] || 7) * 24 * 60 * 60 * 1000), // Mặc định 7 ngày
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Chỉ gửi qua HTTPS ở production
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Chống CSRF, 'none' nếu frontend/backend khác domain
        path: '/', // Cookie áp dụng cho toàn bộ trang web
    }

    res.cookie('token', token, cookieOptions);
    user.password = undefined; // Không gửi password về client

    res.status(statusCode).json({
        success: true,
        message: 'Xác thực thành công',
        data: {
            user,
        },
    });
}

// Đăng ký người dùng
module.exports.register = async (req, res, next) => {
    try {
        // Validate dữ liệu đầu vào
        const validatedData = registerSchema.parse(req.body);

        // Kiểm tra email đã tồn tại chưa
        const existingUser = await User.findOne({ email: validatedData.email });
        if (existingUser) {
            const err = new Error('Email đã được sử dụng');
            err.statusCode = 400;
            return next(err);
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
        next(error);
    }
}

// Đăng nhập người dùng
module.exports.login = async (req, res, next) => {
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
        next(error);
    }
}

// Đăng xuất người dùng
module.exports.logout = async (req, res, next) => {
    try {
        res.cookie('token', '', {
            expires: new Date(0), // Hết hạn ngay lập tức
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            path: '/',
        });

        res.status(200).json({
            success: true,
            message: 'Đăng xuất thành công',
        });
    } catch (error) {
        next(error);
    }
};
