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

// Schema xác thực cho cập nhật thông tin người dùng
const updateInfoSchema = z.object({
    full_name: z.string()
        .trim()
        .min(1, 'Họ và tên là bắt buộc'),
    bio: z.string()
        .optional()
        .or(z.literal('')),
    avatar: z.string()
        .url('Avatar phải là một URL hợp lệ')
        .optional()
        .or(z.literal('')),
});

const updateSettingsSchema = z.object({
    notifications: z.object({
        email: z.boolean().optional(),
        push: z.boolean().optional(),
        mentions: z.boolean().optional(),
        card_assignments: z.boolean().optional(),
        comments: z.boolean().optional(),
        due_reminders: z.boolean().optional(),
        board_updates: z.boolean().optional(),
    }).optional(),
    appearance: z.object({
        theme: z.enum(['light', 'dark', 'system']).optional(),
        language: z.string().optional(),
        timezone: z.string().optional(),
        date_format: z.string().optional(),
    }).optional(),
    privacy: z.object({
        profile_visibility: z.enum(['private', 'members', 'public']).optional(),
        activity_visibility: z.enum(['private', 'members', 'public']).optional(),
        default_board: z.enum(['private', 'members', 'public']).optional(),
    }).optional(),
    account: z.object({
        linked_devices: z.array(z.string()).optional(),
    }).optional(),
});

module.exports = {
    registerSchema,
    loginSchema,
    updateInfoSchema,
    updateSettingsSchema,
};
