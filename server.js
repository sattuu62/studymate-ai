```js
const express = require("express");
const dotenv = require("dotenv");
const { GoogleGenAI } = require("@google/genai");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("ERROR: GEMINI_API_KEY is missing.");
}

const ai = new GoogleGenAI({
    apiKey: apiKey
});

const PRIMARY_MODEL = process.env.GEMINI_PRIMARY_MODEL || "gemini-3.6-flash";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash";

function sleep(ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}

function getErrorStatus(error) {
    if (!error) return 0;
    return error.status || (error.error && error.error.code) || 0;
}

async function generateWithFallback(prompt, config) {
    const models = [PRIMARY_MODEL, FALLBACK_MODEL];

    let lastError = null;

    for (const model of models) {
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                console.log("Trying Gemini model:", model, "Attempt:", attempt);

                const response = await ai.models.generateContent({
                    model: model,
                    contents: prompt,
                    config: config
                });

                console.log("Gemini response received from:", model);

                return response;

            } catch (error) {
                lastError = error;

                const status = getErrorStatus(error);

                console.error(
                    "Gemini error | Model:",
                    model,
                    "| Attempt:",
                    attempt,
                    "| Status:",
                    status
                );

                if (
                    status === 503 ||
                    status === 500 ||
                    status === 502 ||
                    status === 429
                ) {
                    if (attempt < 2) {
                        await sleep(1500);
                        continue;
                    }

                    break;
                }

                throw error;
            }
        }
    }

    throw lastError;
}

app.get("/health", function (req, res) {
    res.json({
        status: "StudyMate server is working"
    });
});

app.post("/ask", async function (req, res) {
    console.log("Received /ask request");

    const question = req.body.question;
    const mode = req.body.mode || "chat";

    if (!question || typeof question !== "string" || !question.trim()) {
        return res.status(400).json({
            error: "Please enter something first."
        });
    }

    const cleanQuestion = question.trim();
    let prompt = "";

    if (mode === "summarize") {
        prompt =
            "You are StudyMate AI, a helpful school study assistant.\n\n" +
            "Summarize these notes using:\n" +
            "1. Key Points\n" +
            "2. Important Concepts\n" +
            "3. Important Definitions\n" +
            "4. Quick Revision Points\n\n" +
            "Use simple language. Do not add information not present in the notes.\n\n" +
            "NOTES:\n" +
            cleanQuestion;

    } else if (mode === "quiz") {
        prompt =
            "Create exactly 5 multiple choice questions about this topic.\n\n" +
            "Return ONLY valid JSON in this format:\n" +
            "{\"questions\":[{\"question\":\"Question\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"answer\":0}]}\n\n" +
            "Rules:\n" +
            "Exactly 5 questions.\n" +
            "Exactly 4 options per question.\n" +
            "answer must be 0, 1, 2, or 3.\n" +
            "0 means A, 1 means B, 2 means C, 3 means D.\n" +
            "Suitable for school students.\n" +
            "No markdown.\n" +
            "No explanations.\n\n" +
            "TOPIC:\n" +
            cleanQuestion;

    } else if (mode === "flashcards") {
        prompt =
            "Create exactly 8 study flashcards about this topic.\n\n" +
            "Return ONLY valid JSON in this format:\n" +
            "{\"flashcards\":[{\"front\":\"Question or term\",\"back\":\"Answer\"}]}\n\n" +
            "Rules:\n" +
            "Exactly 8 flashcards.\n" +
            "Keep answers concise.\n" +
            "Cover important concepts and definitions.\n" +
            "Suitable for school students.\n" +
            "No markdown.\n\n" +
            "TOPIC:\n" +
            cleanQuestion;

    } else if (mode === "planner") {
        prompt =
            "You are StudyMate AI, a study planning assistant.\n\n" +
            "Create a realistic study plan from the student's information.\n\n" +
            "Include daily tasks, subject priorities, revision, practice questions, " +
            "short breaks, final revision, and useful study tips.\n\n" +
            "Do not make the schedule unrealistically intense.\n\n" +
            "STUDENT DETAILS:\n" +
            cleanQuestion;

    } else {
        prompt =
            "You are StudyMate AI, a friendly study assistant for school students.\n\n" +
            "Answer the student's question clearly and accurately.\n\n" +
            "Use simple language.\n" +
            "Explain difficult concepts step by step.\n" +
            "Give examples when useful.\n" +
            "Avoid unnecessary jargon.\n\n" +
            "QUESTION:\n" +
            cleanQuestion;
    }

    try {
        console.log("Sending request to Gemini...");
        console.log("Mode:", mode);

        const config = {};

        if (mode === "quiz" || mode === "flashcards") {
            config.responseMimeType = "application/json";
        }

        const response = await generateWithFallback(prompt, config);

        const answer = response.text;

        if (!answer) {
            return res.status(500).json({
                error: "Gemini returned an empty response."
            });
        }

        if (mode === "quiz" || mode === "flashcards") {
            try {
                const parsed = JSON.parse(answer);

                return res.json({
                    answer: parsed,
                    mode: mode
                });

            } catch (parseError) {
                console.error("JSON PARSE ERROR:", parseError);
                console.error("GEMINI RESPONSE:", answer);

                return res.status(500).json({
                    error: "Gemini returned invalid quiz data."
                });
            }
        }

        return res.json({
            answer: answer,
            mode: mode
        });

    } catch (error) {
        console.error("================================");
        console.error("GEMINI ERROR");
        console.error(error);
        console.error("================================");

        const status = getErrorStatus(error);

        if (status === 429) {
            return res.json({
                answer: "⚠️ StudyMate is temporarily busy because the Gemini limit was reached. Please try again later.",
                mode: mode
            });
        }

        if (status === 503) {
            return res.json({
                answer: "⚠️ Gemini is temporarily busy. Please try again in a few minutes.",
                mode: mode
            });
        }

        if (status === 404) {
            return res.status(500).json({
                error: "The Gemini model is unavailable for this API key."
            });
        }

        return res.status(500).json({
            error: "StudyMate could not connect to Gemini right now."
        });
    }
});

const server = app.listen(PORT, "0.0.0.0", function () {
    console.log("========================================");
    console.log("       StudyMate AI is running!");
    console.log("       http://localhost:" + PORT);
    console.log("========================================");
});

server.on("error", function (error) {
    console.error("SERVER ERROR:");
    console.error(error);

    if (error.code === "EADDRINUSE") {
        console.error("Port is already in use.");
    }
});

process.on("uncaughtException", function (error) {
    console.error("UNCAUGHT EXCEPTION:");
    console.error(error);
});

process.on("unhandledRejection", function (error) {
    console.error("UNHANDLED REJECTION:", error);
});
```
