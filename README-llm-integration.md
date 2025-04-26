# LLM Integration for Learnify

This document explains how the Learnify platform integrates with the custom LLM agent for providing AI-powered chat responses.

## Overview

The integration connects the Learnify frontend with the Python-based LLM agent located in the `../LLM/Learnify-Agent-0.85` directory. The integration uses a streaming approach to provide real-time responses to user queries.

## Architecture

The architecture follows these components:

1. **Frontend UI (React/Next.js)**:

   - `CourseChatWindow.tsx`: Handles the chat interface and user interactions
   - `Message.tsx`, `CodeBlock.tsx`, `Mermaid.tsx`: Render different types of messages

2. **API Layer (Next.js API Routes)**:

   - `course-chats/sessions/[id]/stream/route.ts`: API route that handles the streaming responses

3. **LLM Integration Layer**:

   - Custom Python bridge script that connects to the LLM agent
   - Handles data transformation between the web application and the Python agent

4. **LLM Agent (Python)**:
   - Located at `../LLM/Learnify-Agent-0.85`
   - Processes queries and generates responses with different content types
   - Supports streaming responses for real-time feedback

## How It Works

1. User sends a message through the chat interface
2. The frontend creates a streaming request to the API route
3. The API route creates a temporary Python script that interfaces with the LLM agent
4. The Python script processes the user's message and streams the response back
5. The frontend receives and displays the streaming response in real-time
6. Different message types (text, code, diagrams) are properly formatted and displayed

## Message Types

The integration supports multiple message types:

- **Text**: Regular text responses
- **Code**: Code blocks with syntax highlighting
- **Mermaid**: Diagrams rendered with Mermaid.js
- **Error**: Error messages with appropriate styling

## Setup and Testing

1. Ensure the LLM agent is in the correct location (`../LLM/Learnify-Agent-0.85`)
2. Verify the Python environment has all required dependencies
3. Run the test script to validate the integration:

```bash
cd Learnify
python src/llm-test.py
```

## Troubleshooting

If you encounter issues with the LLM integration, check the following:

1. Verify the LLM agent path is correct
2. Check that Python can access the agent module
3. Ensure all dependencies are installed
4. Verify the API keys are properly set up in the `.env` file
5. Check console logs for any error messages

## Future Improvements

Potential future improvements for the LLM integration:

1. Better handling of different response types
2. Improved error handling and fallback mechanisms
3. Support for more complex interactions like file uploads and images
4. Caching of common responses for better performance
5. Context-aware responses based on course content
