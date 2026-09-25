# 🌪️ Weather Map & AI Weather Assistant (Windy Clone)

Ứng dụng bản đồ thời tiết toàn cầu tương tác theo thời gian thực (lấy cảm hứng từ Windy), tích hợp mô phỏng dòng chảy gió sống động, 8 lớp dữ liệu khí tượng chuyên sâu và **Trợ lý AI phân tích thời tiết thông minh (Google Gemini)**.

---

## 📌 Mục lục

1. [Tính năng nổi bật](#-tính-năng-nổi-bật)
2. [Kiến trúc hệ thống & Công nghệ](#-kiến-trúc-hệ-thống--công-nghệ)
3. [Cấu trúc thư mục dự án](#-cấu-trúc-thư-mục-dự-án)
4. [Hướng dẫn cài đặt & Khởi chạy](#-hướng-dẫn-cài-đặt--khởi-chạy)
5. [Cấu hình biến môi trường (.env)](#-cấu-hình-biến-môi-trường-env)
6. [Chi tiết các thành phần chính](#-chi-tiết-các-thành-phần-chính)
7. [Nguồn dữ liệu & Bản quyền](#-nguồn-dữ-liệu--bản-quyền)

---

## ✨ Tính năng nổi bật

### 🗺️ 1. Bản đồ & Lớp thời tiết tương tác
* **Mô phỏng luồng gió sống động**: Sử dụng `leaflet-velocity` hiển thị các hạt vector gió (U/V) chuyển động theo hướng và tốc độ thực tế.
* **8 Lớp dữ liệu khí tượng trực quan**:
  * 💨 **Gió (Wind)**: Vận tốc và hướng gió ở độ cao 10m.
  * 🌡️ **Nhiệt độ (Temperature)**: Bản đồ nhiệt độ bề mặt toàn cầu.
  * 🌧️ **Mưa (Precipitation)**: Lượng mưa tích tụ.
  * ☁️ **Mây (Cloud cover)**: Tỉ lệ che phủ mây.
  * 🧭 **Áp suất (Pressure)**: Khí áp mực nước biển kết hợp các đường đẳng áp (**Isobar**) vẽ bằng thuật toán *Marching Squares*.
  * ☀️ **Chỉ số UV**: Mức độ bức xạ cực tím.
  * 🌫️ **Chất lượng không khí (Air Quality)**: Nồng độ bụi mịn PM2.5.
  * 🌊 **Sóng biển (Marine Waves)**: Độ cao sóng biển dành cho ngư dân và hàng hải.
* **Chuyển đổi mượt mà & Nội suy màu**: Sử dụng Canvas 2D với thuật toán nội suy song tuyến tính (*Bilinear Interpolation*) theo phép chiếu Mercator chuẩn xác.
* **Hỗ trợ World Wrapping**: Trượt xoay 360° vòng quanh địa cầu không bị đứt đoạn hay lỗi hiển thị.
* **Ranh giới quốc gia (Borders)**: Lớp GeoJSON biên giới sắc nét luôn nổi trên các tầng màu khí tượng.

### ⏱️ 2. Dòng thời gian (Timeline 7 ngày)
* Dự báo chi tiết theo từng giờ trong suốt **7 ngày tới**.
* Thanh trượt 24 giờ trực quan và các tab chọn ngày linh hoạt.
* Chế độ **Tự động chạy (Play / Pause)** mô phỏng diễn biến thời tiết theo thời gian thực.

### 📍 3. Khám phá điểm & Biểu đồ Meteogram
* **Click điểm bất kỳ**: Tra cứu tức thì nhiệt độ, độ ẩm, hướng gió, lượng mưa và tooltip gió quay 360°.
* **Định vị GPS**: Nút định vị vị trí hiện tại của người dùng với hiệu ứng radar nhấp nháy.
* **Tìm kiếm địa điểm**: Thanh tìm kiếm hỗ trợ autocomplete địa danh tiếng Việt và toàn cầu qua Open-Meteo Geocoding.
* **Biểu đồ Meteogram 24h**: Tích hợp Chart.js hiển thị tương quan giữa nhiệt độ và lượng mưa trong 24 giờ tới.

### 🤖 4. Trợ lý AI Thời tiết (Weather AI Agent)
* **Hỏi đáp thông minh (Context-Aware Q&A)**:
  * Người dùng chọn 1 vị trí trên bản đồ và đặt câu hỏi tự nhiên (VD: *"Chiều nay ở đây có cần mang áo mưa không?", "Gió tối nay có mạnh để đi cắm trại không?"*).
  * AI sử dụng **100% số liệu thực tế** được trích xuất từ vị trí và mốc thời gian đang chọn, không tự bịa đặt dữ liệu (*Zero Hallucination*).
* **Báo cáo tự động & Đồ thị phân tích**:
  * Tùy chọn phạm vi: **24 giờ**, **3 ngày** hoặc **7 ngày**.
  * Vẽ đồ thị xu hướng nhiệt độ - lượng mưa kèm bảng nhận xét và cảnh báo thời tiết tự động do AI sinh ra.
* **Bảo mật tuyệt đối**: Backend Node.js hoạt động như một reverse proxy, giữ `GEMINI_API_KEY` an toàn ở server-side, không bao giờ lộ về trình duyệt.

---

## 🏗️ Kiến trúc hệ thống & Công nghệ

```
┌─────────────────────────────────────────────────────────────┐
│                       BROWSER (CLIENT)                      │
│                                                             │
│   ┌───────────────┐   ┌─────────────────┐   ┌───────────┐   │
│   │  Leaflet Map  │   │ leaflet-velocity│   │  Chart.js │   │
│   └───────────────┘   └─────────────────┘   └───────────┘   │
│          ▲                     ▲                  ▲         │
│   ┌──────┴────────┐   ┌────────┴────────┐   ┌─────┴─────┐   │
│   │   layers.js   │   │ weather-data.js │   │ click-info│   │
│   └───────────────┘   └─────────────────┘   └───────────┘   │
│          │                     │                            │
│          │            ┌────────┴────────┐                   │
│          │            │ IndexedDB Cache │                   │
│          │            └─────────────────┘                   │
│          ▼                                                  │
│   ┌─────────────────────────────────────┐                   │
│   │      Agent UI (weather-agent.js)    │                   │
│   └──────────────────┬──────────────────┘                   │
└──────────────────────┼──────────────────────────────────────┘
                       │ HTTP Context + Question
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    NODE.JS BACKEND (PORT 5501)               │
│                                                             │
│   server/server.js (Express Proxy)                          │
│   ├── Kiểm tra ngữ cảnh (Context Validation)                │
│   ├── Khóa API Key an toàn (.env)                           │
│   └── Gửi Prompt chuẩn hóa kèm dữ liệu thực tế              │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   GOOGLE GEMINI AI API                      │
│                 (Model: gemini-3.6-flash)                   │
└─────────────────────────────────────────────────────────────┘
```

### Công nghệ sử dụng:
* **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3 (Glassmorphism Dark UI).
* **Bản đồ & Trực quan hóa**:
  * [Leaflet 1.9.4](https://leafletjs.com/)
  * [leaflet-velocity](https://github.com/onaci/leaflet-velocity)
  * [Chart.js 4.x](https://www.chartjs.org/)
  * CartoDB Dark Matter Basemap
* **Backend**: Node.js, Express, dotenv, cors.
* **AI Model**: Google Gemini API (`gemini-3.6-flash`).
* **Storage & Optimization**: IndexedDB API (cache lưới thời tiết ~666 điểm × 7 ngày).

---

## 📁 Cấu trúc thư mục dự án

```
weather-map/
├── index.html                  # Giao diện chính của ứng dụng
├── package.json                # Quản lý script khởi động toàn dự án
├── .gitignore                  # Bỏ qua node_modules và file .env bảo mật
├── css/
│   └── style.css               # Phong cách giao diện dark-mode và responsive
├── js/
│   ├── map-init.js             # Khởi tạo Leaflet map, GPS, Throttled Fetch, IndexedDB Cache
│   ├── borders.js              # Tải và hiển thị ranh giới quốc gia (GeoJSON)
│   ├── click-info.js           # Bắt tương tác click trên bản đồ, lấy dữ liệu thời tiết điểm
│   ├── meteogram.js            # Biểu đồ thời tiết mini 24h
│   ├── weather-data.js         # Quản lý tải dữ liệu lưới toàn cầu (Main, Secondary, Regional)
│   ├── layers.js               # Render canvas 8 lớp thời tiết, Isobar, hạt gió vector
│   ├── timeline.js             # Điều khiển thanh timeline, tab 7 ngày và animation phát
│   └── search.js               # Tìm kiếm địa điểm tiếng Việt qua Geocoding API
├── agent/
│   ├── weather-context.js      # Bộ quản lý ngữ cảnh dữ liệu thực cho AI Agent
│   ├── weather-agent.js        # Logic giao diện chat và gửi request hỏi đáp AI
│   ├── weather-chart.js        # Đồ thị phân tích phục vụ báo cáo thời tiết
│   └── weather-report.js       # Xử lý tạo báo cáo và nhận xét xu hướng thời tiết
├── server/
│   ├── server.js               # Backend Express proxy kết nối Google Gemini API
│   ├── package.json            # Cấu hình dependency cho backend
│   ├── env.example             # File mẫu cấu hình biến môi trường
│   ├── .env                    # File cấu hình môi trường thật (chứa GEMINI_API_KEY)
│   └── README.md               # Tài liệu chi tiết riêng cho Backend Agent
└── scripts/
    └── static-server.js        # Server tĩnh Node.js phục vụ Frontend (port 5500)
```

---

## 🚀 Hướng dẫn cài đặt & Khởi chạy

### Yêu cầu hệ thống:
* **Node.js** >= phiên bản 18 (đã tích hợp sẵn `fetch` native).
* Trình duyệt web hiện đại (Chrome, Edge, Firefox, Safari).

### Các bước thực hiện:

#### 1. Cài đặt Dependencies
Từ thư mục gốc dự án, chạy lệnh:
```bash
npm install
```
*(Hook `postinstall` sẽ tự động cài đặt các thư viện cần thiết cho cả thư mục gốc và thư mục `server/`).*

#### 2. Cấu hình Gemini API Key
1. Vào thư mục `server/`, sao chép file `env.example` thành `.env`:
   ```bash
   cp server/env.example server/.env
   ```
2. Mở file `server/.env` và điền khóa API của bạn:
   ```env
   PORT=5501
   GEMINI_API_KEY=AIzaSy...your_gemini_api_key_here
   GEMINI_MODEL=gemini-3.6-flash
   ```
   > 💡 **Cách lấy API Key miễn phí**: Truy cập [Google AI Studio](https://aistudio.google.com/apikey), đăng nhập tài khoản Google và nhấn **Create API key** (hoàn toàn miễn phí, không yêu cầu thẻ tín dụng).

#### 3. Khởi chạy ứng dụng (Chỉ với 1 lệnh)
Chạy lệnh sau tại thư mục gốc:
```bash
npm run dev
```

Lệnh này sẽ khởi chạy đồng thời cả hai tiến trình qua `concurrently`:
* **Frontend Web**: [http://localhost:5500](http://localhost:5500)
* **Backend Agent Proxy**: [http://localhost:5501](http://localhost:5501)

Mở trình duyệt và truy cập `http://localhost:5500` để bắt đầu trải nghiệm!

*(Để dừng ứng dụng, nhấn `Ctrl + C` một lần trên cửa sổ dòng lệnh).*

---

## ⚙️ Các lệnh chạy độc lập (Tùy chọn)

Nếu bạn muốn chạy riêng từng phần để kiểm thử hoặc phát triển:

* **Chỉ chạy Frontend Server**:
  ```bash
  npm run dev:frontend
  ```
  *(Truy cập tại `http://localhost:5500`)*

* **Chỉ chạy Backend Agent**:
  ```bash
  npm run dev:backend
  ```
  *(Kiểm tra sức khỏe backend: `curl http://localhost:5501/api/agent/health`)*

---

## 🔍 Chi tiết các giải pháp kỹ thuật nổi bật

### 1. Cơ chế chống lỗi Rate Limit (HTTP 429) & IndexedDB Caching
* Dữ liệu lưới khí tượng toàn cầu rất lớn (~666 điểm × 7 ngày dự báo). Nếu lưu trong `localStorage` sẽ lập tức vượt giới hạn 5MB của trình duyệt. 
* Hệ thống chuyển sang sử dụng **IndexedDB** (`windyCloneCache`), cho phép lưu trữ hàng chục megabyte dữ liệu một cách an toàn và tải tức thì trong vòng 30 phút mà không cần gọi lại API.
* Bộ điều phối **Throttled Fetch** giới hạn khoảng cách tối thiểu giữa các request (350ms), tự động gộp các request trùng lặp (*in-flight deduplication*) và tự động backoff retry khi gặp mã lỗi 429 hoặc 5xx.

### 2. Chiếu bản đồ Mercator & Thuật toán Nội suy Bilinear
* Tọa độ thời tiết được trả về dưới dạng lưới vĩ độ - kinh độ đều nhau. Nếu vẽ trực tiếp lên bản đồ Web Mercator sẽ bị méo ở các vĩ độ cao.
* Hàm `buildScalarCanvasDataUrl` tính toán chiều cao canvas theo tỉ lệ độ dãn Mercator thực tế (`latToMercatorY`), sau đó lấy mẫu màu nội suy 4 điểm lân cận (*Bilinear Sampling*) để tạo ra các dải màu mượt mà như ảnh vệ tinh thực.

### 3. Đường đẳng áp (Isobar) bằng Marching Squares
* Lớp Áp suất sử dụng thuật toán **Marching Squares** duyệt qua ma trận lưới khí áp để vẽ các đường đẳng mức từ 972 hPa đến 1048 hPa với bước nhảy 4 hPa.

---

## 🌐 Nguồn dữ liệu & Giấy phép sử dụng

* **Dữ liệu thời tiết & Geocoding**: Cung cấp bởi [Open-Meteo](https://open-meteo.com/) (Dưới giấy phép CC BY 4.0).
* **Ranh giới quốc gia**: [Natural Earth Vector](https://www.naturalearthdata.com/) (Public Domain).
* **Bản đồ nền (Tiles)**: CartoDB Dark Matter © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, © [CARTO](https://carto.com/attributions).
* **Trí tuệ nhân tạo**: Google Generative AI (Gemini Flash).

---

*Dự án phục vụ mục đích nghiên cứu, học tập và phát triển ứng dụng web khí tượng hiện đại.*
