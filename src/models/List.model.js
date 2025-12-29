const mongoose = require("mongoose");

const ListSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "List phải có tiêu đề"],
    trim: true,
    maxlength: [100, "Tiêu đề không quá 100 ký tự"],
  },
  board: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Board",
    required: true,
    index: true,
  },
  pos: {
    type: Number,
    required: true,
    default: 0,
  },
  color: {
    type: String,
    default: "gray",
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

// Auto update updated_at
ListSchema.pre("findOneAndUpdate", function () {
  this.set({ updated_at: Date.now() });
});

// Index cho sort list trong board
ListSchema.index({ board: 1, order: 1 });

module.exports = mongoose.model("List", ListSchema);
