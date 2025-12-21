const { z } = require('zod');

// Schema xác thực cho đăng ký người dùng
const registerSchema = z.object({
    full_name: z.string()
        .min(1, 'Họ và tên là bắt buộc')
        .trim(),
    email: z.string()
        .trim()
        .email('Email không hợp lệ')
        .toLowerCase(),
    password: z.string()
        .trim()
        .min(6, 'Mật khẩu phải ít nhất 6 ký tự'),
    bio: z.string()
        .optional()
        .or(z.literal('')), // Cho phép rỗng
    avatar: z.string()
        .url()
        .optional()
        .or(z.literal('')), // Cho phép rỗng
});

// Schema xác thực cho đăng nhập người dùng
const loginSchema = z.object({
    email: z.string()
        .trim()
        .email('Email không hợp lệ')
        .toLowerCase(),
    password: z.string()
        .min(6, 'Mật khẩu phải ít nhất 6 ký tự'),
});

module.exports = {
    registerSchema,
    loginSchema,
};
