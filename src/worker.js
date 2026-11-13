
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        if (!env.GEMINI_API_KEY) {
          return Response.json(
            { error: "AI key is not configured yet." },
            { status: 500 }
          );
        }

        const body = await request.json();
        const messages = Array.isArray(body.messages)
          ? body.messages.slice(-20)
          : [];

        const contents = messages
          .filter(m => ["user", "assistant"].includes(m.role))
          .map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: String(m.text || "").slice(0, 6000) }]
          }));

        if (!contents.length) {
          return Response.json(
            { error: "No message provided." },
            { status: 400 }
          );
        }

        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": env.GEMINI_API_KEY
            },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{
                  text: "You are ZAYRO AI, a helpful, honest and clear assistant. Reply in the same language as the user. If the user writes Albanian, reply naturally in Albanian."
                }]
              },
              contents,
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1200
              }
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          return Response.json(
            { error: data.error?.message || "AI service error." },
            { status: response.status }
          );
        }

        const reply = data.candidates?.[0]?.content?.parts
          ?.map(part => part.text || "")
          .join("");

        return Response.json({ reply: reply || "Nuk mora përgjigje." });

      } catch (error) {
        return Response.json(
          { error: "Server error. Please try again." },
          { status: 500 }
        );
      }
    }

    return env.ASSETS.fetch(request);
  }
};
