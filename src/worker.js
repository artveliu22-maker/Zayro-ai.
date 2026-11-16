
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") {
        return Response.json(
          { error: "Method not allowed." },
          { status: 405 }
        );
      }

      try {
        if (!env.GEMINI_API_KEY) {
          return Response.json(
            { error: "GEMINI_API_KEY mungon në Cloudflare Secrets." },
            { status: 500 }
          );
        }

        let body;

        try {
          body = await request.json();
        } catch {
          return Response.json(
            { error: "Kërkesa nuk përmban JSON të vlefshëm." },
            { status: 400 }
          );
        }

        const messages = Array.isArray(body.messages)
          ? body.messages.slice(-20)
          : [];

        const contents = messages
          .filter(m =>
            m &&
            ["user", "assistant"].includes(m.role) &&
            typeof m.text === "string"
          )
          .map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.text.slice(0, 6000) }]
          }))
          .filter(m => m.parts[0].text.trim().length > 0);

        if (!contents.length) {
          return Response.json(
            { error: "Nuk u gjet asnjë mesazh." },
            { status: 400 }
          );
        }

        const geminiResponse = await fetch(
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

        const data = await geminiResponse.json();

        if (!geminiResponse.ok) {
          return Response.json(
            {
              error: data.error?.message || "Gemini API error.",
              status: geminiResponse.status
            },
            { status: 502 }
          );
        }

        const reply = data.candidates?.[0]?.content?.parts
          ?.map(part => part.text || "")
          .join("");

        if (!reply) {
          return Response.json(
            { error: "Gemini nuk ktheu tekst përgjigjeje." },
            { status: 502 }
          );
        }

        return Response.json({ reply });

      } catch (error) {
        return Response.json(
          {
            error: "Gabim në Worker: " +
              (error?.message || "Gabim i panjohur.")
          },
          { status: 500 }
        );
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return Response.json(
        { error: "API route nuk u gjet." },
        { status: 404 }
      );
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("ZAYRO AI is running. Assets binding is missing.", {
      status: 500
    });
  }
};
