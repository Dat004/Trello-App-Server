const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Schema = mongoose.Schema;

const UserSchema = new Schema({
    // Thông tin bắt buộc
    full_name: {
        type: String,
        required: [true, 'Họ và tên là bắt buộc'],
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Email là bắt buộc'],
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        // Chỉ required nếu đăng ký bằng username-password
        // Sau này khi hỗ trợ Google login, password có thể null
        required: false,
        minlength: [6, 'Mật khẩu phải ít nhất 6 ký tự'],
        select: false, // Không trả về password trong các truy vấn mặc định
    },
    bio: {
        type: String,
        default: 'No bio yet.',
        trim: true,
    },
    avatar: {
        type: String,
        default: 'https://ui-avatars.com/api/?name=User&background=random', // Fallback URL đẹp
    },
    providers: {
        type: [String], // ['password', 'google']
        required: true,
        default: ['password'],
    },

    // Theo dõi thời gian
    create_at: {
        type: Date,
        default: Date.now,
        immutable: true, // Không cho sửa sau khi tạo
    },
    updated_at: {
        type: Date,
        default: Date.now,
    },
    last_logged: {
        type: Date,
        default: Date.now,
    },

    // Trạng thái online
    is_online: {
        type: Boolean,
        default: false,
    },

    // Cài đặt người dùng
    settings: {
        notifications: {
            email: { type: Boolean, default: true },
            push: { type: Boolean, default: true },
            mentions: { type: Boolean, default: true },
            card_assignments: { type: Boolean, default: true },
            comments: { type: Boolean, default: false },
            due_reminders: { type: Boolean, default: true },
            board_updates: { type: Boolean, default: false },
        },
        appearance: {
            theme: {
                type: String,
                enum: ['light', 'dark', 'system'],
                default: 'system',
            },
            language: { type: String, default: 'vi' },
            timezone: { type: String, default: 'Asia/Ho_Chi_Minh' },
            date_format: { type: String, default: 'DD/MM/YYYY' },
        },
        privacy: {
            profile_visibility: {
                type: String,
                enum: ['private', 'members', 'public'],
                default: 'members',
            },
            activity_visibility: {
                type: String,
                enum: ['private', 'members', 'public'],
                default: 'members',
            },
            default_board: {
                type: String,
                enum: ['private', 'members', 'public'],
                default: 'private',
            },
        },
        account: {
            linked_devices: {
                type: [String],
                default: [],
            },
        },
    },
});

// Cập nhật updated_at khi có thay đổi
UserSchema.pre('save', function () {
    this.updated_at = Date.now();
});

// Hash password chỉ khi có password và bị thay đổi
UserSchema.pre('save', async function () {
    if (this.isModified('password') && this.password) {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
    }
});

// Phương thức so sánh password
UserSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password) return false; // Không có password (login bằng Google)
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
