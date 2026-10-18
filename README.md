# StudyBuddy AI 🎓

> A premium, AI-powered academic chatbot for students — built with **FastAPI + Gemini AI + Vanilla JS**

---

## ✨ Features

| Feature | Details |
|---|---|
| 🤖 Real AI Responses | Powered by Google Gemini 1.5 Flash |
| 📚 Multi-Subject Support | Math, Science, Code, English, History |
| 🌐 Bilingual | English & Hindi (Hinglish) responses |
| 💻 Code Helper | Syntax-highlighted code + Copy button |
| 📝 Markdown Rendering | Bold, lists, tables, code blocks |
| 💬 Chat History | Session-based conversation memory |
| 📱 Fully Responsive | Mobile, tablet & desktop |
| 🔒 Secure | API key stays server-side only |

---

## 📁 Project Structure

```
studybuddy-ai/
├── backend/
│   ├── main.py            # FastAPI app & Gemini integration
│   ├── requirements.txt   # Python dependencies
│   ├── .env.example       # Environment variable template
│   └── .env               # ← You create this (never commit!)
│
├── frontend/
│   ├── index.html         # Main HTML page
│   ├── css/
│   │   └── style.css      # All styles
│   └── js/
│       └── app.js         # Chat logic & API calls
│
└── README.md
```

---

## 🚀 Setup & Run (Local)

### Prerequisites
- **Python 3.10+** installed
- A free **Google Gemini API key** → [Get one here](https://aistudio.google.com/app/apikey)

---

### Step 1 — Clone / Open the Project

Navigate to the project folder:
```bash
cd studybuddy-ai
```

---

### Step 2 — Configure the API Key

```bash
# Copy the template
cp backend/.env.example backend/.env
```

Open `backend/.env` and replace the placeholder:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

> ⚠️ **Never commit your `.env` file to version control.**

---

### Step 3 — Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

---

### Step 4 — Start the Backend

```bash
# From the backend/ directory
python main.py
```

Or with uvicorn directly:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at: **http://localhost:8000**

---

### Step 5 — Open the Frontend

The backend automatically serves the frontend. Just open your browser and go to:

```
http://localhost:8000
```

> 💡 **Alternatively**, you can open `frontend/index.html` directly in a browser — but you'll need the backend running for AI to work.

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Check API status & AI readiness |
| `POST` | `/chat` | Send a message, get AI reply |
| `GET` | `/` | Serve the frontend |

### `/chat` Request Body
```json
{
  "message": "Explain Python loops",
  "history": [],
  "language": "English",
  "subject": "Programming"
}
```

---

## 🔐 Security

- The Gemini API key is **only stored in `backend/.env`** and never exposed to the browser.
- All AI requests go through the FastAPI backend.
- The frontend never has direct access to the API key.

---

## 🛠 Troubleshooting

| Problem | Solution |
|---|---|
| "Backend offline" in sidebar | Start the backend: `python main.py` |
| "API key not set" | Add `GEMINI_API_KEY` to `backend/.env` |
| "API rate limit reached" | Wait a moment and retry |
| CORS errors in browser | Ensure backend is running on port 8000 |
| Port 8000 already in use | Change port: `uvicorn main:app --port 8080` (update `CONFIG.API_BASE` in `app.js` too) |

---

## 🎨 Tech Stack

- **Backend:** Python · FastAPI · Google Generative AI SDK · Uvicorn
- **Frontend:** HTML5 · CSS3 (custom properties, grid, flex) · Vanilla JS (ES2022)
- **Markdown:** marked.js · highlight.js
- **Icons:** Phosphor Icons

---

## 📄 License

MIT — free for personal and educational use.
