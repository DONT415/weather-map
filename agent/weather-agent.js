/* ======================================================
   FILE: agent/weather-agent.js
   Chức năng: Chức năng 1 - Trợ lý hỏi đáp thời tiết theo ngữ cảnh bản đồ.
   Gửi câu hỏi + WeatherContext.getSnapshot() (dữ liệu THẬT) lên backend
   Agent (server/) để LLM trả lời. API key LLM không xuất hiện ở đây -
   chỉ nằm phía backend (server/.env).
   ====================================================== */

const AGENT_API_BASE = 'http://localhost:5501';

(function () {
  const toggleBtn = document.getElementById('agent-toggle-btn');
  const closeBtn = document.getElementById('agent-close-btn');
  const panel = document.getElementById('agent-panel');
  const tabs = document.querySelectorAll('.agent-tab');
  const tabContents = document.querySelectorAll('.agent-tab-content');

  const statusEl = document.getElementById('agent-context-status');
  const chatLog = document.getElementById('agent-chat-log');
  const askForm = document.getElementById('agent-ask-form');
  const questionInput = document.getElementById('agent-question-input');

  function togglePanel(show) {
    const willShow = (typeof show === 'boolean') ? show : panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !willShow);
  }

  toggleBtn.addEventListener('click', function () { togglePanel(); });
  closeBtn.addEventListener('click', function () { togglePanel(false); });

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.toggle('active', t === tab); });
      tabContents.forEach(function (c) {
        c.classList.toggle('active', c.id === 'agent-tab-' + tab.dataset.tab);
      });
    });
  });

  function updateContextStatus() {
    if (!WeatherContext.hasLocation()) {
      statusEl.textContent = 'Chưa chọn điểm nào trên bản đồ. Vui lòng click 1 vị trí trên bản đồ trước khi hỏi.';
      statusEl.classList.add('warn');
      return;
    }
    const snap = WeatherContext.getSnapshot();
    const place = snap.location.label || `${snap.location.lat.toFixed(2)}, ${snap.location.lon.toFixed(2)}`;
    const ts = snap.selectedTimestamp ? ` · mốc giờ: ${snap.selectedTimestamp}` : '';
    statusEl.textContent = `📍 ${place}${ts}`;
    statusEl.classList.remove('warn');
  }

  WeatherContext.onChange(updateContextStatus);
  updateContextStatus();

  function appendMessage(role, text) {
    const bubble = document.createElement('div');
    bubble.className = 'agent-msg agent-msg-' + role;
    bubble.textContent = text;
    chatLog.appendChild(bubble);
    chatLog.scrollTop = chatLog.scrollHeight;
    return bubble;
  }

  async function ask(question) {
    if (!WeatherContext.hasLocation()) {
      appendMessage('user', question);
      const warnBubble = appendMessage('assistant', 'Vui lòng chọn 1 điểm trên bản đồ trước khi hỏi Agent.');
      warnBubble.classList.add('agent-msg-error');
      return;
    }

    appendMessage('user', question);
    const loadingBubble = appendMessage('assistant', 'Đang trả lời...');

    try {
      const response = await fetch(`${AGENT_API_BASE}/api/agent/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: WeatherContext.getSnapshot(), question: question })
      });

      if (!response.ok) {
        const errBody = await response.json().catch(function () { return {}; });
        throw new Error(errBody.error || `Status ${response.status}`);
      }

      const data = await response.json();
      loadingBubble.textContent = data.answer || 'Không nhận được câu trả lời.';
    } catch (error) {
      console.error('Lỗi Agent hỏi đáp:', error);

      if (error instanceof TypeError) {
        loadingBubble.textContent =
          `Không kết nối được backend Agent tại ${AGENT_API_BASE} ` +
          '(kiểm tra đã chạy "npm run dev" ở thư mục gốc project chưa).';
      } else {
        loadingBubble.textContent = `Backend Agent báo lỗi: ${error.message}`;
      }
      loadingBubble.classList.add('agent-msg-error');
    }
  }

  askForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const question = questionInput.value.trim();
    if (!question) return;
    questionInput.value = '';
    ask(question);
  });

  window.WeatherAgent = { ask: ask };
})();