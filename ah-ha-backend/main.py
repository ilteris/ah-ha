import datetime
import os
from typing import List, Optional

import config
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from google.genai import types as genai_types
from models import AhHaSnippet, SnippetText
from services.adk_service import get_adk_runner, get_tagging_agent

app = FastAPI()

adk_runner = get_adk_runner()
tagging_agent = get_tagging_agent()  # This is the LlmAgent from adk_service.py

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ah_ha_storage = []
next_id = 1


@app.post("/api/v1/snippets", response_model=AhHaSnippet)
async def create_ah_ha(snippet: AhHaSnippet):
    global next_id
    snippet.id = next_id
    next_id += 1
    snippet.timestamp = datetime.datetime.now()

    print(f"Attempting to generate tags for: '{snippet.title}' using LlmAgent")

    if adk_runner and tagging_agent and snippet.content:
        print(
            "ADK LlmAgent and Runner are available. Proceeding with direct tag generation."
        )
        try:
            user_prompt = f'Title: "{snippet.title}"\nContent: "{snippet.content}"'
            input_message = genai_types.Content(
                role="user", parts=[genai_types.Part(text=user_prompt)]
            )

            user_id = f"user_snippet_{snippet.id if snippet.id else 'new'}"
            session_id_for_adk = (
                f"session_tagging_{snippet.id if snippet.id else os.urandom(8).hex()}"
            )

            current_session = await adk_runner.session_service.get_session(
                app_name=adk_runner.app_name,
                user_id=user_id,
                session_id=session_id_for_adk,
            )
            if not current_session:
                await adk_runner.session_service.create_session(
                    app_name=adk_runner.app_name,
                    user_id=user_id,
                    session_id=session_id_for_adk,
                )

            print(f"ADK Prompt for {session_id_for_adk} (to LlmAgent): {user_prompt}")

            final_tags_text = None
            parsed_tags_list = []

            print(f"\n--- ADK Event Stream for {session_id_for_adk} (LlmAgent) ---")
            event_count = 0
            async for event in adk_runner.run_async(
                user_id=user_id,
                session_id=session_id_for_adk,
                new_message=input_message,
            ):
                event_count += 1
                print(
                    f"\n[EVENT {event_count}] ID: {event.id}, Author: {event.author}, Invocation ID: {event.invocation_id}"
                )
                if event.content and event.content.parts:
                    for i, part in enumerate(event.content.parts):
                        print(f"  Part {i}:")
                        if part.text:
                            print(
                                f"    Text: '{part.text[:200]}...' (Partial: {event.partial})"
                            )
                            # If it's the final text from the LlmAgent, capture it
                            if event.is_final_response() and not event.partial:
                                final_tags_text = part.text.strip()

                if event.actions:  # Should be minimal for direct LlmAgent
                    print(
                        f"  Actions: state_delta={event.actions.state_delta}, artifact_delta={event.actions.artifact_delta}, transfer={event.actions.transfer_to_agent}, escalate={event.actions.escalate}"
                    )

                if event.is_final_response():
                    print(f"[EVENT {event_count}] This is a final response event.")
                    if (
                        final_tags_text is not None
                    ):  # Check if final_tags_text is not None
                        print(f"  Final text from LlmAgent: '{final_tags_text}'")
                        raw_tags = final_tags_text.split(",")
                        parsed_tags_list = [
                            tag.strip().lower() for tag in raw_tags if tag.strip()
                        ]
                        if parsed_tags_list:
                            print(
                                f"  Tags parsed from LlmAgent direct output: {parsed_tags_list}"
                            )
                        else:
                            print(
                                f"  Could not parse tags from LlmAgent direct output: '{final_tags_text}'"
                            )
                    elif (
                        event.content
                        and event.content.parts
                        and any(  # Ensure event.content.parts is also checked
                            p.text for p in event.content.parts if p.text
                        )
                    ):  # Check if final event has text not captured
                        temp_final_text = "".join(
                            [p.text for p in event.content.parts if p.text]
                        ).strip()
                        print(
                            f"  Final event had text, but not captured in final_tags_text. Text: '{temp_final_text}'"
                        )
                    else:
                        print(
                            "  No final text content from LlmAgent in this event to parse for tags."
                        )

            print(
                f"--- End ADK Event Stream for {session_id_for_adk} (Total Events: {event_count}) ---\n"
            )

            if parsed_tags_list:
                snippet.generated_tags = parsed_tags_list
                print(f"Final Parsed Tags from LlmAgent: {snippet.generated_tags}")
            else:
                print("ADK LlmAgent response did not yield parseable tags.")
                snippet.generated_tags = []
        except Exception as e:
            print(f"ERROR generating tags with ADK LlmAgent: {e}")
            snippet.generated_tags = []
    else:
        if not adk_runner or not tagging_agent:
            print("ADK LlmAgent or Runner not available. Skipping AI tag generation.")
        if not snippet.content:
            print("Snippet content is empty. Skipping AI tag generation.")
        snippet.generated_tags = []

    ah_ha_storage.append(snippet)
    return snippet


@app.get("/ah-has/", response_model=List[AhHaSnippet])
async def get_ah_has(search: Optional[str] = None):
    if search:
        search_lower = search.lower()
        return [
            s
            for s in ah_ha_storage
            if search_lower in s.title.lower()
            or (
                s.generated_tags
                and any(search_lower in tag.lower() for tag in s.generated_tags)
            )
            or search_lower in s.content.lower()
            or (s.notes and search_lower in s.notes.lower())
        ]
    return sorted(ah_ha_storage, key=lambda x: x.timestamp, reverse=True)


@app.get("/ah-has/{ah_ha_id}/", response_model=AhHaSnippet)
async def get_ah_ha_by_id(ah_ha_id: int):
    for s in ah_ha_storage:
        if s.id == ah_ha_id:
            return s
    return {"error": "Ah-ha not found"}


mock_chat_log = [
    {
        "id": 1,
        "user": "User",
        "text": "Hey AI, I'm trying to understand the key challenges in adopting large language models for enterprise use. Can you outline some?",
    },
    {
        "id": 2,
        "user": "AI",
        "text": "Certainly! Key challenges for enterprise LLM adoption include: \n1. **Data Security and Privacy:** Handling sensitive company data requires robust security measures. \n2. **Integration with Existing Systems:** LLMs need to seamlessly connect with current enterprise software. \n3. **Customization and Fine-tuning:** Generic models often need significant adaptation for specific business needs. \n4. **Cost of Implementation and Operation:** Both initial setup and ongoing usage can be expensive. \n5. **Ethical Concerns and Bias:** Ensuring fairness and avoiding biased outputs is crucial. \n6. **Scalability and Reliability:** Models must perform consistently under heavy load. \nIs there any specific area you'd like to dive deeper into?",
    },
    {
        "id": 3,
        "user": "User",
        "text": "Let's talk more about Customization and Fine-tuning. What are the common approaches?",
    },
    {
        "id": 4,
        "user": "AI",
        "text": "Common approaches for LLM customization include: \n- **Prompt Engineering:** Crafting detailed and effective prompts to guide the model's output without changing the model itself. This is often the first step. \n- **Few-Shot Learning:** Providing a few examples of the desired input/output format within the prompt. \n- **Fine-Tuning:** Retraining a pre-trained model on a smaller, domain-specific dataset. This is more resource-intensive but can yield highly specialized models. For instance, fine-tuning a general LLM on your company's internal documentation can make it an expert on your products. \n- **Retrieval Augmented Generation (RAG):** Combining an LLM with an external knowledge base. The model retrieves relevant information first, then uses it to generate a response. This helps keep information current and reduces hallucinations.",
    },
    {
        "id": 5,
        "user": "User",
        "text": "That RAG approach sounds very promising for our internal knowledge base. The 'Fine-Tuning' part about making it an expert on our products is also a golden nugget. Thanks!",
    },
    {
        "id": 6,
        "user": "AI",
        "text": "You're welcome! RAG is indeed powerful for leveraging existing knowledge stores. And yes, fine-tuning can create a significant competitive advantage by tailoring the LLM's expertise. Many companies are exploring 'domain-specific fine-tuning' for exactly that reason.",
    },
    {
        "id": 7,
        "user": "User",
        "text": "Okay, one last thing. What about measuring the ROI of LLM projects? It seems a bit abstract.",
    },
    {
        "id": 8,
        "user": "AI",
        "text": "Measuring LLM ROI can be tricky but is essential. Key areas to consider are: \n- **Efficiency Gains:** Time saved on tasks like drafting emails, summarizing documents, or customer support. \n- **Cost Reduction:** Lowering operational costs, e.g., by automating certain workflows. \n- **Improved Decision Making:** Faster access to insights can lead to better strategic choices. \n- **Innovation:** Enabling new products or services. \n- **Employee/Customer Satisfaction:** Better tools for employees or improved customer interactions. \nIt's important to define clear KPIs before starting a project. For example, 'reduce average customer query resolution time by 15%' or 'increase content production by 20%'. These are quantifiable.",
    },
    {
        "id": 9,
        "user": "User",
        "text": "The KPI suggestion: 'reduce average customer query resolution time by 15%' is a great, concrete example. That's very helpful for framing these projects.",
    },
]


@app.get("/mock-chat/")
async def get_mock_chat():
    return mock_chat_log


@app.post("/suggest-tags/")
async def suggest_tags(request: SnippetText):
    snippet_text = request.snippet
    if not snippet_text or len(snippet_text.split()) < 3:
        return {"suggested_tags": []}

    text = snippet_text.lower()
    import re

    text = re.sub(r"[^\w\s]", "", text)
    words = text.split()
    min_word_length = 3
    keywords = [
        word
        for word in words
        if word not in config.STOP_WORDS and len(word) >= min_word_length
    ]

    from collections import Counter

    if not keywords:
        return {"suggested_tags": []}

    word_counts = Counter(keywords)
    top_n = 7
    suggested_tags = []
    for word, _ in word_counts.most_common():
        if len(suggested_tags) < top_n:
            suggested_tags.append(word)
        else:
            break
    return {"suggested_tags": suggested_tags}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8010)
