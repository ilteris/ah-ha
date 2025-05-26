import datetime
import os
from typing import List, Optional

import config
import uvicorn
from bs4 import BeautifulSoup  # Import BeautifulSoup
from fastapi import (
    FastAPI,
    HTTPException,  # For error responses
)
from fastapi.middleware.cors import CORSMiddleware
from google.genai import types as genai_types
from models import AhHaSnippet, SnippetText
from services.adk_service import get_adk_runner, get_tagging_agent
from services.firestore_service import (
    create_snippet as db_create_snippet,  # Aliased to avoid name clashes if any
)
from services.firestore_service import (
    delete_snippet_by_id as db_delete_snippet_by_id,  # Added delete
)
from services.firestore_service import get_all_snippets as db_get_all_snippets
from services.firestore_service import get_snippet_by_id as db_get_snippet_by_id

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

# In-memory storage removed, will use Firestore
# ah_ha_storage = []
# next_id = 1


@app.post("/api/v1/snippets", response_model=AhHaSnippet)
async def create_ah_ha(snippet_create_data: AhHaSnippet):  # Renamed input for clarity
    # ID and timestamp will be handled by Firestore service or set there
    # snippet_create_data.id is Optional[str] now, Firestore generates it.
    # snippet_create_data.timestamp can be set here or by Firestore server_timestamp

    # If timestamp is not set by client, set it now before sending to ADK/Firestore
    if not snippet_create_data.timestamp:
        snippet_create_data.timestamp = datetime.datetime.now()

    print(
        f"Attempting to generate tags for: '{snippet_create_data.title}' using LlmAgent"
    )

    if adk_runner and tagging_agent and snippet_create_data.content:
        print(
            "ADK LlmAgent and Runner are available. Proceeding with direct tag generation."
        )
        try:
            content_for_llm = snippet_create_data.content
            if (
                snippet_create_data.content_type == "html"
                and snippet_create_data.content
            ):
                soup = BeautifulSoup(snippet_create_data.content, "html.parser")
                content_for_llm = soup.get_text(separator=" ", strip=True)
                print(
                    f"HTML content stripped for LLM. Original length: {len(snippet_create_data.content)}, Stripped length: {len(content_for_llm)}"
                )

            user_prompt = (
                f'Title: "{snippet_create_data.title}"\nContent: "{content_for_llm}"'
            )
            input_message = genai_types.Content(
                role="user", parts=[genai_types.Part(text=user_prompt)]
            )

            # Use a temporary ID for ADK session if snippet ID is not yet available (it won't be from client)
            # Firestore will generate the final ID.
            temp_adk_id_part = (
                snippet_create_data.id
                if snippet_create_data.id
                else os.urandom(4).hex()
            )
            user_id = f"user_snippet_{temp_adk_id_part}"
            session_id_for_adk = (
                f"session_tagging_{temp_adk_id_part}_{os.urandom(4).hex()}"
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
                snippet_create_data.generated_tags = parsed_tags_list
                print(
                    f"Final Parsed Tags from LlmAgent: {snippet_create_data.generated_tags}"
                )
            else:
                print("ADK LlmAgent response did not yield parseable tags.")
                snippet_create_data.generated_tags = []
        except Exception as e:
            print(f"ERROR generating tags with ADK LlmAgent: {e}")
            snippet_create_data.generated_tags = []
    else:
        if not adk_runner or not tagging_agent:
            print("ADK LlmAgent or Runner not available. Skipping AI tag generation.")
        if not snippet_create_data.content:
            print("Snippet content is empty. Skipping AI tag generation.")
        snippet_create_data.generated_tags = []

    # Save to Firestore
    created_snippet = await db_create_snippet(snippet_create_data)
    print(
        f"DEBUG: Returning snippet from create_ah_ha: ID='{created_snippet.id}', Type={type(created_snippet.id)}"
    )  # Debug print
    return created_snippet


@app.get("/ah-has/", response_model=List[AhHaSnippet])
async def get_ah_has(search: Optional[str] = None):
    # Firestore service's get_all_snippets handles search and sorting by timestamp
    return await db_get_all_snippets(search_term=search)


@app.get("/ah-has/{ah_ha_id}/", response_model=AhHaSnippet)
async def get_ah_ha_by_id(ah_ha_id: str):  # ID is now a string from Firestore
    snippet = await db_get_snippet_by_id(ah_ha_id)
    if snippet:
        return snippet
    # return {"error": "Ah-ha not found"} # Or raise HTTPException(status_code=404)
    raise HTTPException(status_code=404, detail="Ah-ha not found")


@app.delete(
    "/api/v1/snippets/{ah_ha_id}", status_code=204
)  # 204 No Content for successful delete
async def delete_ah_ha(ah_ha_id: str):
    success = await db_delete_snippet_by_id(ah_ha_id)
    if not success:
        # This could be because the document didn't exist or an actual delete error occurred.
        # For simplicity, we'll treat "not success" as "not found" or "could not delete".
        # The firestore_service logs the specific error.
        raise HTTPException(
            status_code=404,
            detail=f"Ah-ha snippet with ID {ah_ha_id} not found or could not be deleted.",
        )
    return  # No content to return for 204


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


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8010)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8010)
