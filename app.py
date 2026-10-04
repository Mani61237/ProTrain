import os
import json
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import google.generativeai as genai
# Load environment variables (.env) with fallback to built-in reader
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip("'\""))

app = Flask(__name__)
CORS(app)

# ── API Key ───────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

if not GEMINI_API_KEY:
    print("⚠️ WARNING: GEMINI_API_KEY is not set. Please add it to your .env file.")
else:
    genai.configure(api_key=GEMINI_API_KEY)

# ── Model (compatible with google-generativeai >= 0.3.x) ─────────────────────
model = genai.GenerativeModel('gemini-2.5-flash')

# ── System Prompt prefix injected into every user message ────────────────────
SYSTEM_PROMPT = (
    "You are an expert sports coach assistant. "
    "Rules you MUST follow:\n"
    "1. Keep every reply SHORT and CONCISE — max 3 bullet points or 2 short paragraphs.\n"
    "2. Use simple, direct language. No fluff or filler.\n"
    "3. Always be encouraging and practical.\n"
    "4. If listing tips, use bullet points (•).\n"
    "5. Never repeat the user's question back to them.\n"
    "6. Do NOT use markdown bold/italic/headers — plain text only.\n\n"
)

# ── Routes ────────────────────────────────────────────────────────────────────

@app.route('/')
def home():
    return jsonify({"message": "Sports Master API is running!"})


@app.route('/chat', methods=['POST'])
def chat():
    """Streaming SSE endpoint for chat queries."""
    try:
        data = request.get_json()
        user_message = data.get('message', '').strip()
        sport = data.get('sport', 'general sports')

        if not user_message:
            return jsonify({"error": "No message provided"}), 400

        # Inject system prompt as a prefix to the user message
        full_prompt = (
            SYSTEM_PROMPT +
            f"Sport context: {sport}.\n"
            f"Player question: {user_message}"
        )

        def generate():
            try:
                response_stream = model.generate_content(full_prompt, stream=True)
                for chunk in response_stream:
                    if chunk.text:
                        payload = json.dumps({"text": chunk.text})
                        yield f"data: {payload}\n\n"
                # Signal completion
                yield "data: " + json.dumps({"done": True}) + "\n\n"
            except Exception as e:
                yield "data: " + json.dumps({"error": str(e)}) + "\n\n"

        return Response(
            stream_with_context(generate()),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no'
            }
        )

    except Exception as e:
        print(f"[chat] Error: {e}")
        return jsonify({"error": str(e)}), 500


DIET_SYSTEM_PROMPT = (
    "You are a certified sports nutritionist and diet coach. "
    "Rules you MUST follow:\n"
    "1. Create a detailed, structured ONE-DAY meal plan with clear meal sections.\n"
    "2. Label each meal in UPPERCASE followed by a colon (e.g. BREAKFAST:).\n"
    "3. For each meal list individual food items, quantities, and approximate calories on separate lines.\n"
    "4. After the meals, add a KEY TIPS: section with exactly 3 practical bullet points for their goal.\n"
    "5. Add a HYDRATION: reminder line at the end.\n"
    "6. Do NOT use markdown bold/italic/headers — plain text only.\n"
    "7. Be specific with food names and gram/ml quantities — no vague portions.\n"
    "8. Stay within the provided calorie target and respect the dietary preference.\n\n"
)


@app.route('/diet', methods=['POST'])
def diet():
    """Streaming SSE endpoint for diet plan generation."""
    try:
        data = request.get_json()
        user_message = data.get('message', '').strip()

        if not user_message:
            return jsonify({"error": "No message provided"}), 400

        full_prompt = DIET_SYSTEM_PROMPT + user_message

        def generate():
            try:
                response_stream = model.generate_content(full_prompt, stream=True)
                for chunk in response_stream:
                    if chunk.text:
                        payload = json.dumps({"text": chunk.text})
                        yield f"data: {payload}\n\n"
                yield "data: " + json.dumps({"done": True}) + "\n\n"
            except Exception as e:
                yield "data: " + json.dumps({"error": str(e)}) + "\n\n"

        return Response(
            stream_with_context(generate()),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no'
            }
        )

    except Exception as e:
        print(f"[diet] Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "message": "Sports Master backend is running",
        "api_configured": bool(GEMINI_API_KEY)
    })


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("=" * 60)
    print("🏆  Sports Master Backend  —  Starting...")
    print("=" * 60)
    print("  http://localhost:5000")
    print("  POST /chat   → streaming SSE chat")
    print("  GET  /health → health check")
    print("=" * 60)
    app.run(debug=True, port=5000)