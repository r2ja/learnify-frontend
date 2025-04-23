# Learning Style Assessment Server

This directory contains the backend server for the learning style assessment feature of Learnify. It uses FastAPI to serve a transformer-based model that analyzes user responses to determine their learning style preferences.

## Requirements

- Python 3.8 or higher
- PyTorch
- Transformers
- FastAPI
- Uvicorn
- NLTK

## Setup

1. Install the required dependencies:

```bash
pip install fastapi uvicorn transformers torch nltk
```

2. Place your trained transformer model in the `learning_style_transformer` directory (this should be located in the same directory as `server.py`). The model should be compatible with HuggingFace's `AutoModelForSequenceClassification` class.

## Running the Server

From this directory, run the following command:

```bash
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

The server will start on `http://localhost:8000`, and the Learnify frontend will connect to it for the learning style assessment.

## API Endpoints

The server provides two main endpoints:

1. **GET /start/**

   - Returns the first question to start the assessment.

2. **POST /answer/**
   - Accepts a user's answer and returns the next question or the final learning style analysis.
   - Requires a JSON body with:
     - `responses`: List of previously validated responses
     - `new_answer`: The user's latest answer

## Learning Style Classification

The model classifies learning preferences across four dimensions:

- **Processing**: Active vs. Reflective
- **Perception**: Sensing vs. Intuitive
- **Input**: Visual vs. Verbal
- **Understanding**: Sequential vs. Global

After completing all questions, the server returns the identified learning style preferences to be stored in the user's profile.

## Integration with Learnify

The Learnify frontend connects to this server through the `ChatbotAssessment` component, which handles:

1. Displaying questions from the server
2. Collecting and validating user responses
3. Sending responses to the server
4. Displaying the final learning style results
5. Saving the learning profile to the Learnify database

## Error Handling

The server validates user responses to ensure they:

- Are not empty
- Are at least 5 characters long
- Are not gibberish (using NLTK to check for valid words)

## Notes

- In a production environment, adjust the CORS settings in the server.py file to restrict access to specific origins.
- Ensure the server is running before users attempt to take the assessment in the frontend application.
