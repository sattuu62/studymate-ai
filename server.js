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

const MODELS = [
process.env.GEMINI_PRIMARY_MODEL || "gemini-3.6-flash",
process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash"
];

function wait(ms) {
return new Promise(function (resolve) {
setTimeout(resolve, ms);
});
}

function getStatus(error) {
if (!error) {
return 0;
}

```
if (error.status) {
    return Number(error.status);
}

if (error.error && error.error.code) {
    return Number(error.error.code);
}

return 0;
```

}

async function askGemini(prompt, config) {
let lastError = null;

```
for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i];

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            console.log("Trying model:", model);
            console.log("Attempt:", attempt);

            const response = await ai.models.generateContent({
                model: model,
                contents: prompt,
                config: config
            });

            console.log("Gemini response received.");

            return response;

        } catch (error) {
            lastError = error;

            const status = getStatus(error);

            console.error(
                "Gemini error:",
                "model=" + model,
                "status=" + status,
                "attempt=" + attempt
            );

            if (
                status === 429 ||
                status === 500 ||
                status === 502 ||
                status === 503
            ) {
                if (attempt === 1) {
                    await wait(2000);
                }

                continue;
            }

            throw error;
        }
    }
}

throw lastError;
```

}

app.get("/health", function (req, res) {
return res.json({
status: "StudyMate server is working"
});
});

app.post("/ask", async function (req, res) {
console.log("Received /ask request");

```
try {
    const body = req.body || {};

    const question =
        typeof body.question === "string"
            ? body.question
            : "";

    const mode =
        typeof body.mode === "string"
            ? body.mode
            : "chat";

    if (question.trim().length === 0) {
        return res.status(400).json({
            error: "Please enter something first."
        });
    }

    const cleanQuestion = question.trim();

    let prompt = "";

    if (mode === "summarize") {
        prompt =
            "You are StudyMate AI, a helpful school study assistant.\n\n" +
            "Summarize the following notes using:\n" +
            "1. Key Points\n" +
            "2. Important Concepts\n" +
            "3. Important Definitions\n" +
            "4. Quick Revision Points\n\n" +
            "Use simple language.\n" +
            "Do not add information that is not present in the notes.\n\n" +
            "NOTES:\n" +
            cleanQuestion;

    } else if (mode === "quiz") {
        prompt =
            "Create exactly 5 multiple choice questions about the topic below.\n\n" +
            "Return ONLY valid JSON in this exact structure:\n" +
            "{\"questions\":[{\"question\":\"Question\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"answer\":0}]}\n\n" +
            "Rules:\n" +
            "Exactly 5 questions.\n" +
            "Exactly 4 options for every question.\n" +
            "answer must be 0, 1, 2, or 3.\n" +
            "0 means A, 1 means B, 2 means C, 3 means D.\n" +
            "Suitable for school students.\n" +
            "No markdown.\n" +
            "No explanations.\n\n" +
            "TOPIC:\n" +
            cleanQuestion;

    } else if (mode === "flashcards") {
        prompt =
            "Create exactly 8 study flashcards about the topic below.\n\n" +
            "Return ONLY valid JSON in this exact structure:\n" +
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

    const config = {};

    if (mode === "quiz" || mode === "flashcards") {
        config.responseMimeType = "application/json";
    }

    console.log("Sending request to Gemini.");
    console.log("Mode:", mode);

    const response = await askGemini(prompt, config);

    const answer = response && response.text
        ? response.text
        : "";

    if (!answer) {
        return res.status(500).json({
            error: "Gemini returned an empty response."
        });
    }

    if (mode === "quiz") {
        try {
            const quiz = JSON.parse(answer);

            if (
                !quiz.questions ||
                !Array.isArray(quiz.questions) ||
                quiz.questions.length !== 5
            ) {
                throw new Error("Invalid quiz format.");
            }

            return res.json({
                answer: quiz,
                mode: mode
            });

        } catch (error) {
            console.error("Quiz JSON error:", error);

            return res.status(500).json({
                error: "Gemini returned invalid quiz data."
            });
        }
    }

    if (mode === "flashcards") {
        try {
            const flashcards = JSON.parse(answer);

            if (
                !flashcards.flashcards ||
                !Array.isArray(flashcards.flashcards) ||
                flashcards.flashcards.length !== 8
            ) {
                throw new Error("Invalid flashcard format.");
            }

            return res.json({
                answer: flashcards,
                mode: mode
            });

        } catch (error) {
            console.error("Flashcard JSON error:", error);

            return res.status(500).json({
                error: "Gemini returned invalid flashcard data."
            });
        }
    }

    return res.json({
        answer: answer,
        mode: mode
    });

} catch (error) {
    console.error("================================");
    console.error("STUDYMATE ERROR");
    console.error(error);
    console.error("================================");

    const status = getStatus(error);

    if (status === 429) {
        return res.status(503).json({
            error: "Gemini is temporarily busy. Please try again later."
        });
    }

    if (status === 503) {
        return res.status(503).json({
            error: "Gemini is temporarily busy. Please try again later."
        });
    }

    if (status === 404) {
        return res.status(500).json({
            error: "The Gemini model is unavailable for this API key."
        });
    }

    return res.status(500).json({
        error: "StudyMate could not process the request right now."
    });
}
```

});

const server = app.listen(PORT, "0.0.0.0", function () {
console.log("========================================");
console.log("       StudyMate AI is running!");
console.log("       Port: " + PORT);
console.log("========================================");
});

server.on("error", function (error) {
console.error("SERVER ERROR:", error);
});

process.on("uncaughtException", function (error) {
console.error("UNCAUGHT EXCEPTION:", error);
});

process.on("unhandledRejection", function (error) {
console.error("UNHANDLED REJECTION:", error);
});
