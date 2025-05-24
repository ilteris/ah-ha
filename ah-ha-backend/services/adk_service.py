import config
from google.adk.agents import LlmAgent  # Changed back to LlmAgent
from google.adk.runners import InMemoryRunner

# Removed unused imports: genai_sdk, CallbackContext, LlmRequest, LlmResponse, FunctionTool

# Callbacks and generate_tags_tool are removed as LlmAgent will directly generate.

# --- ADK Agent and Runner Initialization ---
tagging_agent = None
adk_runner = None

if config.GOOGLE_CLOUD_PROJECT and config.GOOGLE_CLOUD_LOCATION:
    try:
        tagging_agent = LlmAgent(  # Changed to LlmAgent
            name="direct_llm_tag_generator",  # New, simpler name
            model=config.GOOGLE_GENAI_MODEL,  # This should be "gemini-2.0-flash-live-preview-04-09" or similar
            description="A direct LLM agent that generates tags for text snippets based on title and content.",
            instruction=(
                "You are an expert text analyzer. "
                "Given a 'Title' and 'Content' of a text snippet, "
                "your task is to generate 3-5 relevant, concise, comma-separated tags. "
                "Your entire output MUST be *only* the comma-separated list of tags. "
                "Do not include any conversational phrases, affirmations, explanations, or any text other than the tags themselves. "
                "Example input:\nTitle: ADK Events\nContent: Events are fundamental...\nExample output:\nadk,events,framework"
            ),
            tools=[],  # LlmAgent for direct generation typically has no tools.
            # Callbacks removed as they were for tool diagnostics.
        )
        print(
            f"ADK Direct Tagging LlmAgent initialized with model: {tagging_agent.model}."
        )
        adk_runner = InMemoryRunner(agent=tagging_agent, app_name="ah-ha-tagging-app")
        print("ADK InMemoryRunner initialized for LlmAgent.")
    except Exception as e:
        print(f"ERROR: Failed to initialize ADK LlmAgent or Runner: {e}")
        tagging_agent = None
        adk_runner = None
else:
    print(
        "WARNING: config.GOOGLE_CLOUD_PROJECT and/or config.GOOGLE_CLOUD_LOCATION not set. "
        "ADK AI tag generation will be disabled."
    )


def get_adk_runner():
    return adk_runner


def get_tagging_agent():
    return tagging_agent
    return tagging_agent
