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
"gemini-3.6-flash",
"gemini-3.7-flash"
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

if (error.status) {
    return Number(error.status);
}

if (error.code) {
    return Number(error.code);
}

if (error.error && error.error.code) {
    return Number(error.error.code);
}

return 0;

}

function getErrorMessage(error) {
if (!error) {
return "Unknown error";
}

if (error.message) {
    return String(error.message);
}

if (error.error && error.error.message) {
    return String(error.error.message);
}

return String(error);

}

function isRetryableStatus(status) {
return (
status === 429 ||
status === 500 ||
status === 502 ||
status === 503 ||
status === 504
);
}

async function askGemini(prompt, config) {
let lastError = null;

for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i];

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            console.log("Trying model:", model);
            console.log("Attempt:", attempt);

            const request = {
                model: model,
                contents: prompt
            };

            if (config && Object.keys(config).length > 0) {
                request.config = config;
            }

            const response = await ai.models.generateContent(request);

            console.log("Gemini response received.");
            console.log("Successful model:", model);

            return response;

        } catch (error) {
            lastError = error;

            const status = getStatus(error);
            const message = getErrorMessage(error);

            console.error(
                "Gemini error:",
                "model=" + model,
                "status=" + status,
                "attempt=" + attempt
            );

            console.error("Gemini message:", message);

            if (!isRetryableStatus(status)) {
                break;
            }

            if (attempt === 1) {
                await wait(2000);
            }
        }
    }
}

throw lastError || new Error("Gemini request failed.");

}

app.get("/health", function (req, res) {
return res.json({
status: "StudyMate server is working"
});
});

app.post("/ask", async function (req, res) {
console.log("Received /ask request");

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

    const answer =
        response && typeof response.text === "string"
            ? response.text.trim()
            : "";

    if (!answer) {
        console.error("Gemini returned an empty response.");

        return res.status(502).json({
            error: "StudyMate received an empty response. Please try again."
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

            for (let i = 0; i < quiz.questions.length; i++) {
                const item = quiz.questions[i];

                if (
                    !item ||
                    typeof item.question !== "string" ||
                    !Array.isArray(item.options) ||
                    item.options.length !== 4 ||
                    !Number.isInteger(item.answer) ||
                    item.answer < 0 ||
                    item.answer > 3
                ) {
                    throw new Error("Invalid quiz question format.");
                }
            }

            return res.json({
                answer: quiz,
                mode: mode
            });

        } catch (error) {
            console.error("Quiz JSON error:", error);

            return res.status(502).json({
                error: "StudyMate could not format the quiz correctly. Please try again."
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

            for (let i = 0; i < flashcards.flashcards.length; i++) {
                const item = flashcards.flashcards[i];

                if (
                    !item ||
                    typeof item.front !== "string" ||
                    typeof item.back !== "string"
                ) {
                    throw new Error("Invalid flashcard format.");
                }
            }

            return res.json({
                answer: flashcards,
                mode: mode
            });

        } catch (error) {
            console.error("Flashcard JSON error:", error);

            return res.status(502).json({
                error: "StudyMate could not format the flashcards correctly. Please try again."
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
    console.error("================================");
    console.error(error);
    console.error("================================");

    const status = getStatus(error);

    console.error("Final Gemini status:", status);
    console.error("Final Gemini message:", getErrorMessage(error));

    if (status === 429) {
        return res.status(503).json({
            error: "StudyMate is temporarily busy. Please try again in a moment."
        });
    }

    if (
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504
    ) {
        return res.status(503).json({
            error: "StudyMate is temporarily busy. Please try again in a moment."
        });
    }

    if (status === 401 || status === 403) {
        return res.status(500).json({
            error: "StudyMate's AI service needs configuration. Please contact the administrator."
        });
    }

    if (status === 404) {
        return res.status(500).json({
            error: "StudyMate's AI model is currently unavailable. Please try again later."
        });
    }

    return res.status(500).json({
        error: "StudyMate could not process the request right now. Please try again."
    });
}

});

const server = app.listen(PORT, "0.0.0.0", function () {
console.log("========================================");
console.log(" StudyMate AI is running!");
console.log(" Port: " + PORT);
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
