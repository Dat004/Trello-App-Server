const nodemailer = require("nodemailer");

// Cấu hình transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const sendEmail = async ({ to, subject, html }) => {
    try {
      if (!to) return;

      const info = await transporter.sendMail({
          from: '"Trello Clone App" <no-reply@trello-clone.com>',
          to,
          subject,
          html,
      });

      return info;
    } catch (error) {
      console.error("[Email Service] CRITICAL ERROR during send:", error);
    }
};

const sendNotificationEmail = async (user, notificationData) => {
  const { message, sender, workspace, board, card } = notificationData;
  const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  // Khởi tạo link dựa trên đối tượng thông báo
  let redirectLink = baseUrl;
  let targetLabel = "Truy cập hệ thống";

  // Lấy id/title
  const boardId = board?._id;
  const workspaceId = workspace?._id;
  const cardId = card?._id;

  const workspaceTitle = workspace?.name || "Workspace";
  const boardTitle = board?.title || "Bảng";
  const cardTitle = card?.title || "Thẻ";

  if (cardId && boardId) {
      redirectLink = `${baseUrl}/board/${boardId}?cardId=${cardId}`;
      targetLabel = `Xem thẻ "${cardTitle}" →`;
  } else if (boardId) {
      redirectLink = `${baseUrl}/board/${boardId}`;
      targetLabel = `Xem bảng "${boardTitle}" →`;
  } else if (workspaceId) {
      redirectLink = `${baseUrl}/workspace/${workspaceId}`;
      targetLabel = `Xem không gian "${workspaceTitle}" →`;
  }

  const sentDate = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: 'short' });
  const sentTimeOnly = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
    .mail-wrap { font-family: 'Plus Jakarta Sans', 'Segoe UI', Tahoma, sans-serif; background: #13131a; padding: 36px 28px; color: #e4e4f0; }
    .mail-header { background: linear-gradient(135deg, #1d2fbd 0%, #4f46e5 60%, #7c3aed 100%); border-radius: 16px 16px 0 0; padding: 32px 36px 28px; position: relative; overflow: hidden; }
    .brand-row { display: flex; align-items: center; gap: 12px; }
    .brand-name { font-size: 18px; font-weight: 700; color: #fff; letter-spacing: -0.3px; }
    .brand-tagline { font-size: 11px; color: rgba(255,255,255,0.55); font-family: 'DM Mono', monospace; letter-spacing: 0.5px; }
    .mail-card { background: #1e1e2a; border-radius: 0 0 16px 16px; padding: 32px 36px 36px; border: 1px solid #2a2a3a; border-top: none; }
    .sender-row { display: flex; align-items: center; gap: 14px; padding: 16px 18px; background: #252533; border-radius: 12px; margin-bottom: 28px; border: 1px solid #2e2e3e; }
    .avatar { width: 46px; height: 46px; border-radius: 50%; border: 2px solid #4f46e5; display: block; }
    .sender-info { margin-left: 8px; }
    .sender-info .name { font-size: 14px; font-weight: 600; color: #e0e0f0; margin: 0; }
    .sender-info .username { font-size: 12px; color: #5e5e7a; font-family: 'DM Mono', monospace; margin-top: 1px; }
    .sent-time { margin-left: auto; font-size: 11px; color: #3d3d55; font-family: 'DM Mono', monospace; }
    .message-label { font-size: 10px; font-weight: 600; color: #4f46e5; letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 10px; }
    .message-text { font-size: 15px; line-height: 1.7; color: #c8c8e0; margin-bottom: 28px; padding-left: 14px; border-left: 3px solid #4f46e5; }
    .context-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 32px; }
    .chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; border: 1px solid; text-decoration: none; }
    .chip-ws { background: rgba(251,191,36,0.1); border-color: rgba(251,191,36,0.25); color: #fbbf24; }
    .chip-board { background: rgba(79,110,247,0.1); border-color: rgba(79,110,247,0.3); color: #818cf8; }
    .chip-card { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.25); color: #4ade80; }
    .cta-wrap { text-align: center; margin-bottom: 28px; }
    .cta-btn { display: inline-block; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff !important; text-decoration: none; padding: 13px 32px; border-radius: 10px; font-size: 14px; font-weight: 600; letter-spacing: 0.2px; box-shadow: 0 8px 24px rgba(79,70,229,0.35); }
    .cta-sub { font-size: 11px; color: #3d3d55; margin-top: 10px; font-family: 'DM Mono', monospace; }
    .divider { border: none; border-top: 1px solid #252533; margin: 0 0 20px; }
    .mail-footer { text-align: center; font-size: 11px; color: #3d3d55; line-height: 1.8; font-family: 'DM Mono', monospace; }
  </style>
  </head>
  <body>
    <div class="mail-wrap">
      <div class="mail-header">
        <div class="brand-row">
          <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.18); border-radius: 10px; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.2); margin-right: 8px;">
            <svg viewBox="0 0 24 24" style="width: 22px; height: 22px;"><rect x="2" y="2" width="9" height="15" rx="2" fill="white" opacity="0.9"/><rect x="13" y="2" width="9" height="9" rx="2" fill="white" opacity="0.65"/></svg>
          </div>
          <div>
            <div class="brand-name">Trello Clone</div>
            <div class="brand-tagline">workspace notifications</div>
          </div>
        </div>
      </div>
      <div class="mail-card">
        <div class="sender-row">
          <img class="avatar" src="${sender.avatar?.url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(sender.full_name) + '&background=4f46e5&color=fff'}" />
          <div class="sender-info">
            <div class="name">${sender.full_name}</div>
            <div class="username">@${sender.username || 'user'}</div>
          </div>
          <div class="sent-time">${sentTimeOnly} · ${sentDate}</div>
        </div>
        <div class="message-label">Thông báo</div>
        <p class="message-text">${message}</p>
        <div class="cta-wrap">
          <a href="${redirectLink}" class="cta-btn">${targetLabel}</a>
          <div class="cta-sub">Nhấn để chuyển đến không gian làm việc</div>
        </div>
        <hr class="divider" />
        <div class="mail-footer">
          <p>Bạn nhận email này vì đang bật thông báo khi vắng mặt.</p>
          <p>© 2025 Trello Clone Team · All rights reserved.</p>
        </div>
      </div>
    </div>
  </body>
  </html>`;

  return sendEmail({
    to: user.email,
    subject: `[Trello] ${sender.full_name} ${message.length > 50 ? message.substring(0, 50) + '...' : message}`,
    html: htmlContent
  });
};

module.exports = {
  sendEmail,
  sendNotificationEmail
};
