from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import nltk
from nltk.corpus import words
from nltk.tokenize import word_tokenize
import difflib
import os

# Download necessary NLTK data if not already present
nltk.download("punkt")
nltk.download("punkt_tab")  # Ensure the 'punkt_tab' resource is available.
nltk.download("words")

# Build a set of valid English words for quick lookup
VALID_WORDS = set(words.words())


def is_valid_word(word: str) -> bool:
    """
    Check if a word is valid or is close enough to a valid word (to allow minor typos).
    """
    if word.lower() in VALID_WORDS:
        return True
    # Check for a close match (cutoff=0.8 allows for minor spelling errors)
    matches = difflib.get_close_matches(word.lower(), VALID_WORDS, n=1, cutoff=0.8)
    return len(matches) > 0


def is_gibberish(text: str) -> bool:
    """
    Check if the given text is likely to be gibberish.
    - If text is too short (<5 characters), it's rejected.
    - The text is tokenized, and if fewer than 30% of the tokens are valid (or close) words,
      then the response is considered gibberish.
    """
    if len(text) < 5:
        return True
    tokens = word_tokenize(text)
    if not tokens:
        return True
    valid_count = sum(1 for token in tokens if is_valid_word(token))
    if valid_count / len(tokens) < 0.3:
        return True
    return False


# Load transformer model (adjust model_dir as needed)
model_dir = r"C:\Users\inaya\OneDrive\Desktop\fyp diagnostic test\P3_LSD\backend\learning_style_transformer"
tokenizer = AutoTokenizer.from_pretrained(model_dir)
model = AutoModelForSequenceClassification.from_pretrained(model_dir)

app = FastAPI()

# Enable CORS (adjust allow_origins in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define the learning style questions.
QUESTIONS = [
    "How do you prefer to gather information? Provide examples.",
    "Do you learn better with pictures, diagrams, or verbal explanations? Why?",
    "When solving problems, do you prefer experimenting or thinking through the problem? Explain.",
    "Do you prefer learning step-by-step or understanding the big picture first? Elaborate.",
]


@app.get("/start/")
async def start_conversation():
    """
    Start the conversation by returning the first question and an empty responses list.
    """
    return {"question": QUESTIONS[0], "responses": []}


class AnswerRequest(BaseModel):
    responses: list[str]
    new_answer: str


def validate_answer(answer: str) -> str:
    """
    Validate a single answer:
      - It must be nonempty and at least 5 characters.
      - It must not be gibberish.
    Returns the cleaned answer or raises HTTPException.
    """
    clean_answer = answer.strip()
    if not clean_answer:
        raise HTTPException(status_code=400, detail="Response cannot be empty.")
    if len(clean_answer) < 5:
        raise HTTPException(
            status_code=400, detail="Response too short. Please provide more details."
        )
    if is_gibberish(clean_answer):
        raise HTTPException(
            status_code=400,
            detail="Your response seems like gibberish. Please provide a meaningful answer.",
        )
    return clean_answer


def predict(responses: list[str]):
    """
    Predict learning styles for the provided responses using the transformer model.
    """
    inputs = tokenizer(responses, padding=True, truncation=True, return_tensors="pt")
    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits
    predictions = torch.argmax(logits, dim=1).tolist()
    return predictions


@app.post("/answer/")
async def process_answer(data: AnswerRequest):
    """
    Process one answer at a time.
    Expects:
      - responses: the list of previous valid answers.
      - new_answer: the latest answer from the user.
    Returns:
      - If more questions remain: the next question and the updated responses.
      - If all questions are answered: the prediction results.
    """
    # Validate the new answer.
    valid_answer = validate_answer(data.new_answer)
    new_responses = data.responses + [valid_answer]
    question_index = len(new_responses)
    if question_index < len(QUESTIONS):
        return {"question": QUESTIONS[question_index], "responses": new_responses}
    elif question_index == len(QUESTIONS):
        # All questions answered; compute prediction.
        predictions = predict(new_responses)
        learning_styles = [
            ("Sensing", "Intuitive"),
            ("Visual", "Verbal"),
            ("Active", "Reflective"),
            ("Sequential", "Global"),
        ]
        results = {
            (
                learning_styles[i][0] if predictions[i] == 1 else learning_styles[i][1]
            ): predictions[i]
            for i in range(len(predictions))
        }
        # Print the score/result in the terminal.
        print("\nFinal Learning Style Result:", results)
        return {
            "learning_style": results,
            "message": "Test complete.",
            "responses": new_responses,
        }
    else:
        raise HTTPException(status_code=400, detail="Too many responses provided.")
