const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Sub-schema for Example Cards
const ExampleCardSchema = new Schema({
    title: {
        type: String,
        required: [true, 'Tiêu đề không được để trống'],
        trim: true,
        maxlength: [100, 'Tiêu đề không được vượt quá 100 ký tự']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Mô tả không được vượt quá 500 ký tự']
    },
    position: {
        type: Number,
        default: 0
    }
}, { _id: true });

// Sub-schema for Lists
const TemplateListSchema = new Schema({
    name: {
        type: String,
        required: [true, 'Tên cột không được để trống'],
        trim: true,
        maxlength: [50, 'Tên cột không được vượt quá 50 ký tự']
    },
    position: {
        type: Number,
        required: true,
        default: 0
    },
    color: {
        type: String,
        default: 'bg-gray-500',
        trim: true
    },
    example_cards: {
        type: [ExampleCardSchema],
        default: []
    }
}, { _id: true });

// Main Template Schema
const TemplateSchema = new Schema({
    name: {
        type: String,
        required: [true, 'Tên template không được để trống'],
        trim: true,
        unique: true,
        maxlength: [100, 'Tên template không được vượt quá 100 ký tự'],
        index: true
    },

    description: {
        type: String,
        required: [true, 'Mô tả không được để trống'],
        trim: true,
        maxlength: [500, 'Mô tả không được vượt quá 500 ký tự']
    },

    category: {
        type: String,
        required: [true, 'Danh mục không được để trống'],
        index: true
    },

    color: {
        type: String,
        default: "bg-blue-500",
        required: [true, 'Màu không được để trống'],
        trim: true,
    },

    lists: {
        type: [TemplateListSchema],
        required: [true, 'Cột không được để trống'],
    },

    tags: {
        type: [String],
        default: [],
    },

    popularity_score: {
        type: Number,
        default: 0,
        min: [0, 'Điểm phổ biến không được nhỏ hơn 0'],
        max: [100, 'Điểm phổ biến không được vượt quá 100']
    },

    usage_count: {
        type: Number,
        default: 0,
        min: [0, 'Số lần sử dụng không được nhỏ hơn 0']
    },

    is_popular: {
        type: Boolean,
        default: false,
        index: true
    },

    is_system: {
        type: Boolean,
        default: true,
    },

    is_active: {
        type: Boolean,
        default: true,
        index: true
    },

    created_by: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    created_at: {
        type: Date,
        default: Date.now
    },

    updated_at: {
        type: Date,
        default: Date.now
    }
});

// Auto updated updated_at
TemplateSchema.pre('save', function () {
    this.updated_at = Date.now();
});

// Instance Methods

// Tăng usage count khi template được sử dụng để tạo board
// Tự động tính toán popularity score và is_popular flag
TemplateSchema.methods.incrementUsage = async function () {
    this.usage_count += 1;

    // Nếu usage_count > 100, đánh dấu là popular
    if (this.usage_count >= 100) {
        this.is_popular = true;
        this.popularity_score = Math.min(100, Math.floor(this.usage_count / 10));
    } else if (this.usage_count >= 50) {
        this.popularity_score = Math.min(50, Math.floor(this.usage_count / 5));
    }

    return this.save();
};

// Static Methods

// Lấy danh sách templates phổ biến - Mặc định 10 templates
TemplateSchema.statics.getPopular = function (limit = 10) {
    return this.find({ is_active: true, is_popular: true })
        .sort({ popularity_score: -1, usage_count: -1 })
        .limit(limit);
};

// Lấy templates theo category - Mặc định 20 templates
TemplateSchema.statics.getByCategory = function (category, limit = 20) {
    return this.find({ is_active: true, category })
        .sort({ popularity_score: -1, usage_count: -1 })
        .limit(limit);
};

// Lấy tất cả templates active, sorted by popularity - Mặc định 50 templates
TemplateSchema.statics.getAllActive = function (limit = 50) {
    return this.find({ is_active: true })
        .sort({ is_popular: -1, popularity_score: -1, usage_count: -1 })
        .limit(limit);
};

// Indexing
TemplateSchema.index({ category: 1, is_active: 1 });
TemplateSchema.index({ is_popular: 1, is_active: 1 });
TemplateSchema.index({ tags: 1 });
TemplateSchema.index({ usage_count: -1 });

module.exports = mongoose.model("Template", TemplateSchema);