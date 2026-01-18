const { z } = require("zod");
const mongoose = require("mongoose");

// Schema xác thực cho đăng ký người dùng
const registerSchema = z.object({
  full_name: z.string().min(1, "Họ và tên là bắt buộc").trim(),
  email: z.string().trim().email("Email không hợp lệ").toLowerCase(),
  password: z.string().trim().min(6, "Mật khẩu phải ít nhất 6 ký tự"),
  bio: z.string().optional().or(z.literal("")), // Cho phép rỗng
});

// Schema xác thực cho đăng nhập người dùng
const loginSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ").toLowerCase(),
  password: z.string().min(6, "Mật khẩu phải ít nhất 6 ký tự"),
});

const avatarSchema = z.object({
  url: z.string().url(),
  public_id: z.string().trim().nullable().optional(),
});

// Schema xác thực cho cập nhật thông tin người dùng
const updateInfoSchema = z.object({
  full_name: z.string().trim().min(1, "Họ và tên là bắt buộc"),
  bio: z.string().optional().or(z.literal("")),
  avatar: avatarSchema.optional(),
});

const updateSettingsSchema = z.object({
  notifications: z
    .object({
      email: z.boolean().optional(),
      push: z.boolean().optional(),
      mentions: z.boolean().optional(),
      card_assignments: z.boolean().optional(),
      comments: z.boolean().optional(),
      due_reminders: z.boolean().optional(),
      board_updates: z.boolean().optional(),
    })
    .optional(),
  appearance: z
    .object({
      theme: z.enum(["light", "dark", "system"]).optional(),
      language: z.string().optional(),
      timezone: z.string().optional(),
      date_format: z.string().optional(),
    })
    .optional(),
  privacy: z
    .object({
      profile_visibility: z.enum(["private", "members", "public"]).optional(),
      activity_visibility: z.enum(["private", "members", "public"]).optional(),
      default_board: z.enum(["private", "members", "public"]).optional(),
    })
    .optional(),
  account: z
    .object({
      linked_devices: z.array(z.string()).optional(),
    })
    .optional(),
});

const updateWorkspaceSchema = z.object({
  name: z.string().trim().max(100, "Tên không quá 100 ký tự").optional(),
  description: z.string().trim().optional(),
  color: z.string().optional(),
  visibility: z.enum(["private", "public"]).optional(),
  max_members: z
    .number()
    .min(5, "Giới hạn thành viên tối thiểu là 5")
    .max(50, "Giới hạn thành viên tối đa là 50")
    .optional(),
});

const PermissionLevelEnum = z.enum(["admin_only", "admin_member"]);

const updatePermissionsSchema = z.object({
  canCreateBoard: PermissionLevelEnum.default("admin_member"),
  canInviteMember: PermissionLevelEnum.default("admin_only"),
});

const inviteMemberSchema = z.object({
  email: z
    .string()
    .min(1, "Email không được để trống.")
    .email({ message: "Email không hợp lệ. Vui lòng nhập lại" })
    .lowercase(),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
});

const objectJd = z
  .string()
  .refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "ID không hợp lệ",
  });

const updateMemberRole = z.object({
  member_id: objectJd,
  role: z.enum(["admin", "member"], {
    message: "Dữ liệu nhận vào phải là: admin | member",
  }),
});

const kickMember = z.object({
  member_id: objectJd,
});

const boardSchema = z.object({
  title: z
    .string()
    .min(1, "Board phải có tiêu đề")
    .max(100, "Tiêu đề không quá 100 ký tự")
    .trim(),
  description: z.string().optional().or(z.literal("")),
  color: z.string().trim(),
  visibility: z.enum(["private", "workspace", "public"]).default("workspace"),
  workspaceId: objectJd.optional(),
});

const updateBoardsSchema = z.object({
  title: z
    .string()
    .min(1, "Board phải có tiêu đề")
    .max(100, "Tiêu đề không quá 100 ký tự")
    .trim(),
  description: z.string().optional().or(z.literal("")),
  color: z.string().trim(),
  visibility: z.enum(["private", "workspace", "public"]).default("workspace"),
});

const listSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "List phải có tiêu đề")
    .max(100, "Tiêu đề không quá 100 ký tự"),
  color: z.string().trim().optional(),
});

const cardSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Tiêu đề không được rỗng")
    .max(200, "Tiêu đề không quá 200 ký tự"),
  description: z.string().trim().optional(),
  due_date: z.coerce.date().optional().nullable(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  labels: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        color: z.string(),
      })
    )
    .optional(),
});

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const attachmentInputSchema = z.object({
  name: z.string().trim(),
  url: z.string().trim().url("URL không hợp lệ"),
  type: z.string().default("file"),
  size: z.coerce
    .number()
    .min(0, "Size phải >= 0")
    .max(MAX_FILE_SIZE, "Size không được vượt quá 20MB")
    .default(0),
  message: z.string().trim().optional().default(""),
});

module.exports = {
  registerSchema,
  loginSchema,
  updateInfoSchema,
  updateSettingsSchema,
  updateWorkspaceSchema,
  updatePermissionsSchema,
  inviteMemberSchema,
  updateMemberRole,
  kickMember,
  boardSchema,
  updateBoardsSchema,
  listSchema,
  cardSchema,
  attachmentInputSchema,
};
