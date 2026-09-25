/* ======================================================
   FILE: server/server.js
   Chức năng: backend proxy nhỏ cho Weather Map Agent.
   - Giữ GEMINI_API_KEY an toàn (chỉ đọc từ .env phía server,
     KHÔNG BAO GIỜ gửi key này về frontend).
   - Nhận context (dữ liệu thời tiết THẬT do frontend tự tính) +
     câu hỏi/số liệu báo cáo, gọi Google Gemini API, trả kết quả về.
   - Không tự sinh dữ liệu thời tiết: toàn bộ số liệu trong context
     đến từ Open-Meteo (qua frontend), server chỉ chuyển tiếp cho LLM.
   ====================================================== */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 5501;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

if (!GEMINI_API_KEY) {
  console.warn(
    '[CẢNH BÁO] Chưa cấu hình GEMINI_API_KEY trong server/.env - ' +
    'Agent sẽ trả lỗi cho tới khi bạn thêm key (xem server/.env.example).'
  );
}

async function callGemini(systemPrompt, userPrompt, maxOutputTokens) {
  if (!GEMINI_API_KEY) {
    throw new Error('Server chưa cấu hình GEMINI_API_KEY (xem server/.env.example).');
  }

  const response = await fetch(`${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        maxOutputTokens: maxOutputTokens || 500,
        thinkingConfig: { thinkingLevel: 'low' }
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API lỗi ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  const textPart = parts.find(function (p) { return typeof p.text === 'string'; });
  return textPart ? textPart.text : '';
}

// ============ CHỨC NĂNG 1: Hỏi đáp theo ngữ cảnh bản đồ ============
const ASK_SYSTEM_PROMPT = `Bạn là trợ lý thời tiết tiếng Việt trong ứng dụng bản đồ thời tiết "Weather Map".
QUY TẮC BẮT BUỘC:
- CHỈ được dùng số liệu có trong khối JSON "DỮ LIỆU THỜI TIẾT TẠI VỊ TRÍ ĐANG CHỌN TRÊN BẢN ĐỒ" được cung cấp bên dưới. Tuyệt đối không tự bịa, không tự đoán số liệu ngoài dữ liệu đó.
- Nếu dữ liệu cung cấp không đủ để trả lời chính xác câu hỏi, hãy nói rõ phần dữ liệu còn thiếu, không cố đoán.
- selectedTimestamp là mốc thời gian người dùng đang chọn trên thanh timeline; selectedConditions là thời tiết tại đúng mốc đó (nếu có). currentConditions là thời tiết hiện tại thực tế (không phụ thuộc timeline). Phân biệt rõ 2 khái niệm này khi trả lời.
- Trả lời ngắn gọn, tự nhiên, dễ hiểu, bằng tiếng Việt. Không dùng markdown, không liệt kê lại JSON.
- Mốc giờ trong dữ liệu đã là giờ máy người dùng.`;

app.post('/api/agent/ask', async function (req, res) {
  try {
    const { context, question } = req.body || {};

    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'Thiếu câu hỏi.' });
    }

    if (!context || !context.location) {
      return res.status(400).json({
        error: 'Chưa chọn vị trí nào trên bản đồ. Vui lòng click 1 điểm trên bản đồ trước khi hỏi.'
      });
    }

    const userPrompt =
      `DỮ LIỆU THỜI TIẾT TẠI VỊ TRÍ ĐANG CHỌN TRÊN BẢN ĐỒ (JSON, lấy thật từ Open-Meteo):\n${JSON.stringify(context)}\n\n` +
      `CÂU HỎI CỦA NGƯỜI DÙNG: ${question}`;

    const answer = await callGemini(ASK_SYSTEM_PROMPT, userPrompt, 600);
    res.json({ answer: answer });
  } catch (error) {
    console.error('[agent/ask]', error);
    res.status(500).json({ error: error.message || 'Lỗi máy chủ Agent.' });
  }
});

// ============ CHỨC NĂNG 2: Báo cáo + nhận xét tự động ============
const REPORT_SYSTEM_PROMPT = `Bạn là trợ lý viết nhận xét thời tiết tiếng Việt cho ứng dụng bản đồ thời tiết "Weather Map".
QUY TẮC BẮT BUỘC:
- CHỈ dùng số liệu có trong khối JSON "SỐ LIỆU TỔNG HỢP" cung cấp bên dưới. Số liệu này đã được tính sẵn bằng công thức thông thường (min/max/tổng/trung bình) từ dữ liệu Open-Meteo thật - bạn KHÔNG được tự tính lại hay bịa thêm số liệu khác.
- Viết đoạn nhận xét ngắn gọn (khoảng 3-6 câu), tiếng Việt tự nhiên, liền mạch (không markdown, không gạch đầu dòng).
- Nêu bật xu hướng chính (nhiệt độ, mưa, gió...) và nhắc tới ít nhất 1-2 con số cụ thể lấy đúng từ dữ liệu được cung cấp.
- Nếu có ngày/giờ đáng chú ý (mưa nhiều, gió mạnh nhất...), nêu rõ thời điểm đó (đã là giờ người dùng, dùng trực tiếp).
- Nếu dữ liệu trống hoặc quá ít, nói rõ là chưa đủ dữ liệu, không suy diễn thêm.`;

app.post('/api/agent/report', async function (req, res) {
  try {
    const { context, rangeDays, stats } = req.body || {};

    if (!stats) {
      return res.status(400).json({ error: 'Thiếu số liệu tổng hợp để viết nhận xét.' });
    }

    const locationInfo = (context && context.location) ? JSON.stringify(context.location) : 'không rõ';
    const userPrompt =
      `Vị trí: ${locationInfo}\n` +
      `Khoảng thời gian phân tích: ${rangeDays} ngày\n` +
      `SỐ LIỆU TỔNG HỢP (JSON, đã tính sẵn từ dữ liệu Open-Meteo thật):\n${JSON.stringify(stats)}`;

    const narrative = await callGemini(REPORT_SYSTEM_PROMPT, userPrompt, 400);
    res.json({ narrative: narrative });
  } catch (error) {
    console.error('[agent/report]', error);
    res.status(500).json({ error: error.message || 'Lỗi máy chủ Agent.' });
  }
});

app.get('/api/agent/health', function (req, res) {
  res.json({ ok: true, hasApiKey: !!GEMINI_API_KEY, model: GEMINI_MODEL });
});

app.listen(PORT, function () {
  console.log(`Weather Agent backend đang chạy tại http://localhost:${PORT}`);
  console.log(`Model đang dùng: ${GEMINI_MODEL} (Google Gemini)`);
});