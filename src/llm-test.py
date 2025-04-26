#!/usr/bin/env python3
"""
Test script for the Learnify LLM integration.
This script verifies that the LLM agent can be called properly from the Next.js app.
"""

import sys
import os
import json
from pathlib import Path

# Add the correct path to the LLM modules
# The LLM folder is in the parent directory of the Learnify project
llm_path = Path(__file__).parent.parent.parent / "LLM" / "Learnify-Agent-0.85"
sys.path.append(str(llm_path))

try:
    from agent.run_chat_agent import run_chat_agent

    print("✅ Successfully imported run_chat_agent")
except ImportError as e:
    print(f"❌ Error importing run_chat_agent: {e}")
    print(f"Make sure the LLM folder is available at: {llm_path}")
    sys.exit(1)


def test_agent():
    """Test the LLM agent with a simple prompt."""
    print("\n🔍 Testing LLM Agent...")

    # Set up test parameters
    test_user_id = "test_user"
    test_course_id = "CS101"
    test_prompt = "What is the difference between a variable and a constant?"
    test_profile = {
        "style": "conceptual",
        "depth": "beginner",
        "interaction": "examples",
    }

    # Define a callback to print streaming chunks
    def stream_callback(chunk):
        chunk_type = chunk.get("type", "unknown")
        content = chunk.get("content", "")
        text = chunk.get("text", "")

        if chunk_type == "text" or chunk_type == "content":
            print(content, end="", flush=True)
        elif chunk_type == "reasoning":
            print(f"\n[REASONING] {text}", end="", flush=True)
        else:
            print(f"\n[{chunk_type.upper()}] {content or text}")

    try:
        # Call the agent with streaming
        print(f"\nSending prompt: '{test_prompt}' to the agent...")
        print("\nResponse:")
        print("-" * 50)

        result = run_chat_agent(
            user_id=test_user_id,
            course_id=test_course_id,
            prompt=test_prompt,
            learning_profile=test_profile,
            language="english",
            stream=True,
            stream_callback=stream_callback,
        )

        print("\n" + "-" * 50)
        print("\n✅ Agent test completed successfully!")

        return True
    except Exception as e:
        print(f"\n❌ Error testing agent: {e}")
        return False


if __name__ == "__main__":
    # Print environment information
    print("\n📊 Environment Information:")
    print(f"Python version: {sys.version}")
    print(f"Current directory: {os.getcwd()}")
    print(f"LLM path: {llm_path}")

    # Test agent
    success = test_agent()

    # Exit with appropriate code
    sys.exit(0 if success else 1)
