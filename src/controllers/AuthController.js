const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const User = require('../models/User.model');
const {
    registerSchema,
    loginSchema,
    googleLoginSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    changePasswordSchema,
} = require('../utils/validationSchemas');
const {
    createPasswordResetToken,
    hashResetToken,
} = require('../services/auth/passwordReset');
const { sendPasswordResetEmail } = require('../services/email/send');


// Tạo JWT
const signToken = (userId, authVersion = 0) => {
    return jwt.sign(
        {
            sub: userId,
            ver: authVersion,
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
    const token = signToken(user._id, user.auth_version || 0);

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

const clearAuthCookie = (res) => {
    res.cookie('token', '', {
        expires: new Date(0),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
    });
};

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
            avatar: {
                url: `https://ui-avatars.com/api/?name=${validatedData.full_name}&background=random`,
                public_id: null,
            },
            providers: ['password'], // Bời vì đây là đăng ký bằng email/password - Mặc định là 'password'
        });
        await newUser.save();

        // Gửi token về client
        sendTokenResponse(newUser, 201, res);
    }
    catch (error) {
        next(error);
    }
}

// Đăng nhập người dùng
module.exports.login = async (req, res, next) => {
    try {
        // Validate dữ liệu đầu vào
        const validationData = loginSchema.parse(req.body);
        // Tìm người dùng theo email
        const user = await User.findOne({ email: validationData.email }).select(
            '+password +auth_version'
        );
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
        clearAuthCookie(res);

        res.status(200).json({
            success: true,
            message: 'Đăng xuất thành công',
        });
    } catch (error) {
        next(error);
    }
};

module.exports.forgotPassword = async (req, res, next) => {
    try {
        const { email } = forgotPasswordSchema.parse(req.body);
        const genericMessage =
            'Nếu email tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu';
        const user = await User.findOne({ email });

        if (user) {
            const { token, tokenHash, expiresAt } = createPasswordResetToken();
            user.password_reset_token = tokenHash;
            user.password_reset_expires = expiresAt;
            await user.save({ validateBeforeSave: false });

            setImmediate(() => {
                sendPasswordResetEmail(user, token).catch((error) => {
                    console.error('[Password Reset Email] Failed:', error);
                });
            });
        }

        res.status(200).json({
            success: true,
            message: genericMessage,
        });
    } catch (error) {
        next(error);
    }
};

module.exports.verifyResetToken = async (req, res, next) => {
    try {
        const { token } = req.params;
        if (!token) {
            return res.status(400).json({ success: false, valid: false });
        }

        const tokenHash = hashResetToken(token);
        const user = await User.findOne({
            password_reset_token: tokenHash,
            password_reset_expires: { $gt: new Date() },
        }).select('_id');

        return res.status(200).json({ success: true, valid: Boolean(user) });
    } catch (error) {
        next(error);
    }
};

module.exports.resetPassword = async (req, res, next) => {
    try {
        const { token, password } = resetPasswordSchema.parse(req.body);
        const tokenHash = hashResetToken(token);
        const user = await User.findOne({
            password_reset_token: tokenHash,
            password_reset_expires: { $gt: new Date() },
        }).select(
            '+password +password_reset_token +password_reset_expires +auth_version'
        );

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
            });
        }

        user.password = password;
        user.password_reset_token = null;
        user.password_reset_expires = null;
        user.invalidateSessions();
        if (!user.providers.includes('password')) {
            user.providers.push('password');
        }
        await user.save();
        clearAuthCookie(res);

        res.status(200).json({
            success: true,
            message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại',
        });
    } catch (error) {
        next(error);
    }
};

module.exports.changePassword = async (req, res, next) => {
    try {
        const { currentPassword, password } = changePasswordSchema.parse(req.body);
        const user = await User.findById(req.user._id).select(
            '+password +auth_version'
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Người dùng không tồn tại',
            });
        }

        if (user.password) {
            if (!currentPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Mật khẩu hiện tại là bắt buộc',
                });
            }
            const isCurrentPassword = await user.comparePassword(currentPassword);
            if (!isCurrentPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Mật khẩu hiện tại không đúng',
                });
            }
            if (await user.comparePassword(password)) {
                return res.status(400).json({
                    success: false,
                    message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
                });
            }
        }

        user.password = password;
        user.password_reset_token = null;
        user.password_reset_expires = null;
        user.invalidateSessions();
        if (!user.providers.includes('password')) {
            user.providers.push('password');
        }
        await user.save();
        clearAuthCookie(res);

        res.status(200).json({
            success: true,
            message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại',
        });
    } catch (error) {
        next(error);
    }
};

// Đăng nhập bằng Google
module.exports.googleLogin = async (req, res, next) => {
    try {
        const { idToken } = googleLoginSchema.parse(req.body);

        // Verify token từ Google
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        // Tìm User trong DB
        let user = await User.findOne({
            $or: [
                { google_id: googleId },
                { email: email }
            ]
        }).select('+auth_version');

        if (user) {
            // Trường hợp user đã tồn tại (login password hoặc login google trước đó)
            let updated = false;

            // Nếu user chưa có google_id (tức là đăng ký password trước đó bằng cùng email)
            if (!user.google_id) {
                user.google_id = googleId;
                updated = true;
            }

            // Thêm provider google nếu chưa có
            if (!user.providers.includes('google')) {
                user.providers.push('google');
                updated = true;
            }

            if (updated) {
                await user.save({ validateBeforeSave: false });
            }
        } else {
            // Trường hợp user mới hoàn toàn
            user = new User({
                full_name: name,
                email: email,
                google_id: googleId,
                providers: ['google'],
                avatar: {
                    url: picture,
                    public_id: null,
                },
                last_logged: Date.now(),
            });

            await user.save({ validateBeforeSave: false });
        }

        // Cập nhật thời gian đăng nhập cuối
        user.last_logged = Date.now();
        await user.save({ validateBeforeSave: false });

        // Trả về token
        sendTokenResponse(user, 200, res);

    } catch (error) {
        next(error);
    }
};
