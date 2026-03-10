const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const generateTemplateFromAI = async (userPrompt, language = "vi") => {
  const systemPrompt = `
    Bạn là một chuyên gia quản lý dự án. Khi nhận được mô tả, hãy tạo ra một template board Kanban chuyên nghiệp.
    Ngôn ngữ phản hồi: ${language === 'vi' ? 'Tiếng Việt' : 'Tiếng Anh'}.

    Cấu trúc JSON yêu cầu:
    {
      "name": "Tên template (ngắn gọn, súc tích)",
      "description": "Mô tả mục đích và cách sử dụng template này",
      "category": "Chọn 1 trong: project-management | development | marketing | personal | education | sales | office",
      "lists": [
        {
          "name": "Tên danh sách (ví dụ: Cần làm, Đang làm, Đã xong...)",
          "position": 0,
          "cards": [
            {
              "title": "Tên thẻ mẫu",
              "description": "Hướng dẫn hoặc mô tả chi tiết cho thẻ này",
              "checklist": ["Bước 1", "Bước 2"],
              "labels": ["urgent", "feature", "bug", "design", "planning"]
            }
          ]
        }
      ],
      "tags": ["3-5 từ khóa liên quan"]
    }

    Quy tắc:
    1. Tạo 3-6 danh sách (lists) phản ánh quy trình làm việc thực tế.
    2. Mỗi danh sách có 2-4 thẻ (cards) minh họa sinh động.
    3. Checklist chỉ thêm khi thật sự cần quy trình cụ thể.
    4. Labels chọn nhãn phù hợp với nội dung thẻ.
    5. Nội dung thẻ phải mang tính thực tiễn cao, không sáo rỗng.
    6. Trả về JSON thuần túy, không bao gồm ký tự markdown hay giải thích bên ngoài.
    7. Đảm bảo tính hợp lệ của JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
      }
    });

    const text = response.text;

    // Parse JSON
    const templateData = JSON.parse(text);

    return {
      template: templateData,
      usage: {
        prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
        completion_tokens: response.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: response.usageMetadata?.totalTokenCount || 0
      }
    };
  } catch (error) {
    console.error("[Gemini Service Error]:", error);

    // Phân biệt các loại lỗi để FE xử lý tốt hơn
    if (error.status === 429) {
      const rateLimitErr = new Error("AI đang quá tải hoặc hết hạn mức, vui lòng thử lại sau 1 phút.");
      rateLimitErr.statusCode = 429;
      throw rateLimitErr;
    }

    if (error.status === 503) {
      const overloadErr = new Error("Hệ thống AI của Google hiện đang quá tải. Vui lòng thử lại sau ít phút.");
      overloadErr.statusCode = 503;
      throw overloadErr;
    }

    if (error.status === 403) {
      const authErr = new Error("API Key AI không hợp lệ hoặc chưa được kích hoạt.");
      authErr.statusCode = 503;
      throw authErr;
    }

    const generalErr = new Error("Không thể tạo template bằng AI. Vui lòng thử lại sau.");
    generalErr.statusCode = 500;
    throw generalErr;
  }
};

const analyzeBoardData = async (boardData, userQuery) => {
  const systemPrompt = `
    Bạn là một trợ lý quản lý dự án thông minh chuyên phân tích bảng Kanban/Trello.
    Dưới đây là cấu trúc dữ liệu hiện tại của dự án dưới dạng JSON:
    
    ${JSON.stringify(boardData)}
    
    Dựa CHỈ VÀO dữ liệu trên, hãy trả lời câu hỏi sau của người dùng một cách chính xác, ngắn gọn và hữu ích.
    Câu hỏi: "${userQuery}"
    
    Yêu cầu định dạng:
    - Trả lời bằng tiếng Việt.
    - Dùng Markdown để trình bày (in đậm, danh sách bullet, emoji...).
    - Phân tích và đưa ra các con số thống kê nếu phù hợp (tổng số thẻ đang làm, trễ hạn, đã xong...).
    - Nếu câu hỏi không liên quan đến dự án, lịch sự nhắc nhở người dùng quay lại chủ đề chính.
    - Tuyệt đối không bịa ra dữ liệu không có trong JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userQuery,
      config: {
        systemInstruction: systemPrompt,
      }
    });

    return response.text;
  } catch (error) {
    console.error("[Gemini Service Error (Analyze)]: ", error);

    if (error.status === 429) {
      const rateLimitErr = new Error("AI đang bận hoặc hết hạn mức miễn phí, vui lòng thử lại sau 1 phút.");
      rateLimitErr.statusCode = 429;
      throw rateLimitErr;
    }

    if (error.status === 503) {
      const overloadErr = new Error("Hệ thống AI của Google hiện đang quá tải. Vui lòng thử lại sau ít phút.");
      overloadErr.statusCode = 503;
      throw overloadErr;
    }

    const generalErr = new Error("Đã có lỗi xảy ra khi xử lý AI. Vui lòng thử lại.");
    generalErr.statusCode = 500;
    throw generalErr;
  }
};

module.exports = {
  generateTemplateFromAI,
  analyzeBoardData
};
