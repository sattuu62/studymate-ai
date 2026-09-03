document.addEventListener("DOMContentLoaded", function () {
    console.log("StudyMate script loaded");

    const year = document.getElementById("year");
    const modal = document.getElementById("askModal");
    const backdrop = document.getElementById("modalBackdrop");
    const closeButton = document.getElementById("modalClose");

    const modalBody = document.getElementById("modalBody");
    const modalForm = document.getElementById("modalForm");
    const modalInput = document.getElementById("modalInput");

    const modalTitle = document.getElementById("modalTitle");
    const modalHint = document.getElementById("modalHint");
    const modalSubmit = document.getElementById("modalSubmit");
    const clearChat = document.getElementById("clearChat");

    if (year) {
        year.textContent = new Date().getFullYear();
    }

    const modes = {
        chat: {
            title: "Ask StudyMate",
            hint: "Ask anything you're studying. StudyMate will explain it clearly.",
            placeholder: "e.g. Explain Newton's second law",
            button: "Ask"
        },
        summarize: {
            title: "Notes Summarizer",
            hint: "Paste your notes and StudyMate will turn them into quick revision points.",
            placeholder: "Paste your notes here...",
            button: "Summarize"
        },
        quiz: {
            title: "Practice Quiz",
            hint: "Enter a topic and StudyMate will generate a 5-question quiz.",
            placeholder: "e.g. Class 10 Physics - Light",
            button: "Generate Quiz"
        },
        flashcards: {
            title: "Flashcards",
            hint: "Enter a topic and StudyMate will create revision flashcards.",
            placeholder: "e.g. Carbon and Its Compounds",
            button: "Generate"
        },
        planner: {
            title: "Study Planner",
            hint: "Tell StudyMate about your exam and available study time.",
            placeholder: "e.g. Exam on 15 September, Maths and Science",
            button: "Create Plan"
        }
    };

    let currentMode = "chat";
    let loading = false;

    function setMode(mode) {
        if (!modes[mode]) {
            mode = "chat";
        }

        currentMode = mode;

        const settings = modes[mode];

        if (modalTitle) {
            modalTitle.textContent = settings.title;
        }

        if (modalHint) {
            modalHint.textContent = settings.hint;
        }

        if (modalInput) {
            modalInput.placeholder = settings.placeholder;
        }

        if (modalSubmit) {
            modalSubmit.textContent = settings.button;
        }
    }

    function clearHistory() {
        if (modalBody) {
            modalBody.innerHTML = "";
        }
    }

    function openTool(mode) {
        console.log("Opening tool:", mode);

        if (!modal) {
            console.error("askModal was not found.");
            return;
        }

        setMode(mode);
        clearHistory();

        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");

        if (modalInput) {
            modalInput.value = "";
            modalInput.disabled = false;
        }

        if (modalSubmit) {
            modalSubmit.disabled = false;
        }

        setTimeout(function () {
            if (modalInput) {
                modalInput.focus();
            }
        }, 100);
    }

    function closeModal() {
        if (!modal) {
            return;
        }

        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
    }

    function connectButton(id, mode) {
        const button = document.getElementById(id);

        if (!button) {
            console.warn("Button not found:", id);
            return;
        }

        button.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();

            console.log("Clicked:", id);

            openTool(mode);
        });
    }

    connectButton("askBtn", "chat");
    connectButton("askBtnHero", "chat");
    connectButton("askBtnFooter", "chat");

    function connectCard(id, mode) {
        const card = document.getElementById(id);

        if (!card) {
            return;
        }

        card.addEventListener("click", function () {
            console.log("Clicked card:", id);
            openTool(mode);
        });
    }

    connectCard("askCard", "chat");
    connectCard("notesCard", "summarize");
    connectCard("quizCard", "quiz");
    connectCard("flashcardsCard", "flashcards");
    connectCard("plannerCard", "planner");

    if (backdrop) {
        backdrop.addEventListener("click", closeModal);
    }

    if (closeButton) {
        closeButton.addEventListener("click", closeModal);
    }

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeModal();
        }
    });

    function addMessage(text, type) {
        if (!modalBody) {
            return null;
        }

        const message = document.createElement("div");

        message.className = "chat-bubble chat-bubble--" + type;
        message.textContent = text;

        modalBody.appendChild(message);
        modalBody.scrollTop = modalBody.scrollHeight;

        return message;
    }

    function addThinking() {
        if (!modalBody) {
            return null;
        }

        const message = document.createElement("div");

        message.className = "chat-bubble chat-bubble--bot";
        message.textContent = "StudyMate is thinking...";

        modalBody.appendChild(message);
        modalBody.scrollTop = modalBody.scrollHeight;

        return message;
    }

    function showAnswer(element, answer) {
        if (!element) {
            return;
        }

        if (typeof answer === "string") {
            element.textContent = answer;
        } else {
            element.textContent = JSON.stringify(answer, null, 2);
        }
    }

    function renderQuiz(element, data) {
        if (!data || !Array.isArray(data.questions)) {
            showAnswer(
                element,
                "I couldn't create the quiz. Please try again."
            );
            return;
        }

        const container = document.createElement("div");
        container.className = "quiz-container";

        const title = document.createElement("h4");
        title.textContent = "Your Practice Quiz";
        container.appendChild(title);

        data.questions.forEach(function (question, index) {
            const box = document.createElement("div");
            box.className = "quiz-question";

            const text = document.createElement("p");
            text.textContent =
                (index + 1) + ". " + (question.question || "Question");

            box.appendChild(text);

            if (Array.isArray(question.options)) {
                question.options.forEach(function (option, optionIndex) {
                    const label = document.createElement("label");
                    label.className = "quiz-option";

                    const input = document.createElement("input");

                    input.type = "radio";
                    input.name = "quiz-question-" + index;
                    input.value = optionIndex;

                    label.appendChild(input);
                    label.appendChild(
                        document.createTextNode(" " + option)
                    );

                    box.appendChild(label);
                });
            }

            box.dataset.answer = String(question.answer);
            container.appendChild(box);
        });

        const checkButton = document.createElement("button");

        checkButton.type = "button";
        checkButton.className = "btn btn--primary";
        checkButton.textContent = "Check Answers";

        const result = document.createElement("p");

        checkButton.addEventListener("click", function () {
            const questions =
                container.querySelectorAll(".quiz-question");

            let score = 0;
            let complete = true;

            questions.forEach(function (question) {
                const selected =
                    question.querySelector("input:checked");

                if (!selected) {
                    complete = false;
                    return;
                }

                if (
                    Number(selected.value) ===
                    Number(question.dataset.answer)
                ) {
                    score++;
                }
            });

            if (!complete) {
                result.textContent =
                    "Please answer all questions first.";
                return;
            }

            result.textContent =
                "You scored " +
                score +
                "/" +
                questions.length +
                "!";

            checkButton.disabled = true;
        });

        container.appendChild(checkButton);
        container.appendChild(result);

        if (element) {
            element.replaceWith(container);
        }
    }

    function renderFlashcards(element, data) {
        if (!data || !Array.isArray(data.flashcards)) {
            showAnswer(
                element,
                "I couldn't create the flashcards. Please try again."
            );
            return;
        }

        const container = document.createElement("div");
        container.className = "flashcards-container";

        const title = document.createElement("h4");
        title.textContent = "Your Flashcards";
        container.appendChild(title);

        const grid = document.createElement("div");
        grid.className = "flashcards-grid";

        data.flashcards.forEach(function (card) {
            const flashcard = document.createElement("button");

            flashcard.type = "button";
            flashcard.className = "flashcard";

            const front = document.createElement("span");
            front.className = "flashcard__front";
            front.textContent = card.front || "Question";

            const back = document.createElement("span");
            back.className = "flashcard__back";
            back.textContent = card.back || "Answer";

            flashcard.appendChild(front);
            flashcard.appendChild(back);

            flashcard.addEventListener("click", function () {
                flashcard.classList.toggle("is-flipped");
            });

            grid.appendChild(flashcard);
        });

        container.appendChild(grid);

        const instruction = document.createElement("p");
        instruction.textContent =
            "Click a card to reveal the answer.";

        container.appendChild(instruction);

        if (element) {
            element.replaceWith(container);
        }
    }

    if (clearChat) {
        clearChat.addEventListener("click", function () {
            clearHistory();

            if (modalHint) {
                modalHint.textContent = modes[currentMode].hint;
            }

            if (modalInput) {
                modalInput.value = "";
                modalInput.focus();
            }
        });
    }

    if (modalForm) {
        modalForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            if (loading || !modalInput) {
                return;
            }

            const question = modalInput.value.trim();

            if (!question) {
                modalInput.focus();
                return;
            }

            loading = true;

            const mode = currentMode;

            addMessage(question, "user");

            modalInput.value = "";
            modalInput.disabled = true;

            if (modalSubmit) {
                modalSubmit.disabled = true;
                modalSubmit.textContent = "Thinking...";
            }

            const thinking = addThinking();

            try {
                const response = await fetch("/ask", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        question: question,
                        mode: mode
                    })
                });

                const contentType =
                    response.headers.get("content-type") || "";

                if (
                    !contentType
                        .toLowerCase()
                        .includes("application/json")
                ) {
                    const raw = await response.text();

                    console.error(
                        "SERVER RETURNED NON-JSON:",
                        raw
                    );

                    throw new Error(
                        "StudyMate server returned an invalid response."
                    );
                }

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.error ||
                        "StudyMate request failed."
                    );
                }

                if (mode === "quiz") {
                    renderQuiz(thinking, data.answer);
                } else if (mode === "flashcards") {
                    renderFlashcards(thinking, data.answer);
                } else {
                    showAnswer(thinking, data.answer);
                }

            } catch (error) {
                console.error("STUDYMATE ERROR:", error);

                showAnswer(
                    thinking,
                    error.message ||
                    "Something went wrong. Please try again."
                );

            } finally {
                loading = false;

                if (modalInput) {
                    modalInput.disabled = false;
                    modalInput.focus();
                }

                if (modalSubmit) {
                    modalSubmit.disabled = false;
                    modalSubmit.textContent =
                        modes[currentMode].button;
                }
            }
        });
    }

    setMode("chat");

    console.log(
        "StudyMate AI frontend loaded successfully."
    );
});
