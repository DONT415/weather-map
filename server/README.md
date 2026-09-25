# Weather Map Agent - Backend

Backend nhỏ (Node.js + Express) đóng vai trò **proxy giữa frontend và Google Gemini API**,
để API key LLM không bao giờ bị lộ ra phía trình duyệt (client-side).

Frontend (`agent/weather-agent.js`, `agent/weather-report.js`) chỉ gọi tới backend này
qua HTTP (`http://localhost:5501`), không bao giờ gọi thẳng Gemini API.

## Cài đặt & chạy (khuyến nghị - tự động, 1 lệnh)

Yêu cầu Node.js >= 18 (dùng `fetch` có sẵn, không cần cài thêm thư viện HTTP).

Từ **thư mục gốc project** (không phải trong `server/`):

```bash
npm install
```

Lệnh này tự cài luôn dependency cho `server/` (qua hook `postinstall` trong
`package.json` ở thư mục gốc), không cần chạy `npm install` riêng trong `server/` nữa.

Copy `server/env.example` thành `server/.env`, điền `GEMINI_API_KEY` — lấy
**miễn phí** tại https://aistudio.google.com/apikey (đăng nhập bằng tài khoản
Google, bấm "Create API key", không cần thẻ ngân hàng).

```bash
npm run dev
```

Lệnh này khởi động **CẢ frontend lẫn backend cùng lúc**:
- Frontend: `http://localhost:5500`
- Backend Agent: `http://localhost:5501`

Không cần mở thêm terminal riêng để `cd server && npm start` nữa. Nhấn `Ctrl+C`
1 lần trong terminal đang chạy `npm run dev` để tắt cả 2.

Kiểm tra backend nhanh (khi đang chạy):

```bash
curl http://localhost:5501/api/agent/health
```

## Chạy backend riêng (debug độc lập, không bắt buộc)

Nếu chỉ muốn chạy riêng backend để debug (không cần frontend):

```bash
cd server
npm start
```

Nếu bạn đổi cổng backend trong `.env` (`PORT=...`), nhớ sửa lại hằng số
`AGENT_API_BASE` ở đầu file `agent/weather-agent.js` cho khớp.

## Endpoint

- `POST /api/agent/ask` — `{ context, question }` → `{ answer }` (Chức năng 1: hỏi đáp, **bắt buộc** phải có `context.location` - tức đã chọn 1 điểm trên bản đồ, nếu không sẽ trả lỗi 400 và KHÔNG gọi Gemini)
- `POST /api/agent/report` — `{ context, rangeDays, stats }` → `{ narrative }` (Chức năng 2: nhận xét báo cáo)
- `GET  /api/agent/health` — kiểm tra server sống + đã có API key hay chưa

Đây là API riêng của backend này (không phải API của Gemini) — dù sau này đổi
sang nhà cung cấp AI khác, chỉ cần sửa bên trong `server.js`, không cần đụng
tới frontend, miễn giữ đúng hình dạng request/response này.

Lưu ý: trước đây `/api/agent/ask` có hỗ trợ hỏi thẳng 1 địa danh bất kỳ mà
không cần chọn điểm trên bản đồ (model tự gọi tool geocode). Tính năng này đã
bị loại bỏ theo yêu cầu - giờ bắt buộc phải chọn 1 điểm trên bản đồ trước khi
hỏi Agent.

## Vì sao dùng Gemini thay vì Anthropic API

Google AI Studio cấp API key **miễn phí thật sự** (không phải trial có hạn mức rồi hết) cho
các model dòng Flash, giới hạn khoảng 10-15 request/phút — thừa đủ cho 1 project cá nhân/demo.
Đánh đổi: dữ liệu gửi lên ở gói free có thể được Google dùng để cải thiện model của họ (không
sao với project demo, nhưng nên biết nếu sau này xử lý dữ liệu nhạy cảm).

Nếu muốn quay lại Anthropic (chất lượng suy luận tốt hơn, nhưng trả phí theo lượng dùng sau khi
hết trial credit), chỉ cần viết lại hàm `callGemini` trong `server.js` theo định dạng Anthropic
Messages API — phần còn lại của file (system prompt, endpoint) không cần đổi.

## Khi deploy thật (không chỉ chạy local)

- Đặt biến môi trường `GEMINI_API_KEY` trên nền tảng hosting backend (Render, Railway,
  Netlify Functions...), không đưa file `.env` thật lên git.
- Sửa `AGENT_API_BASE` trong `agent/weather-agent.js` trỏ sang domain backend thật.
- Cân nhắc thêm giới hạn CORS (`cors({ origin: 'https://domain-frontend-that-cua-ban' })`)
  thay vì cho phép mọi origin như cấu hình mặc định hiện tại (phù hợp cho dev local).