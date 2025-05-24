import datetime
import os  # Added for API Key
from typing import List, Optional

import google.generativeai as genai  # Added for Gemini
import uvicorn
from dotenv import load_dotenv  # Added for .env file
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

load_dotenv()  # Load environment variables from .env file

# CORS configuration
origins = [
    "http://localhost",  # Common for local dev
    "http://localhost:5173",  # Default Vite dev server port
    "http://127.0.0.1:5173",  # Also common for Vite
    # Add any other origins if your frontend runs on a different port/domain
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for Ah-ha moments
ah_ha_storage = []
next_id = 1

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print(
        "WARNING: GEMINI_API_KEY environment variable not set. AI tag generation will be disabled."
    )

# Stop words list (can be expanded)
STOP_WORDS = set(
    [
        "a",
        "an",
        "the",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "being",
        "have",
        "has",
        "had",
        "do",
        "does",
        "did",
        "will",
        "would",
        "should",
        "can",
        "could",
        "may",
        "might",
        "must",
        "and",
        "but",
        "or",
        "nor",
        "for",
        "so",
        "yet",
        "if",
        "then",
        "else",
        "when",
        "where",
        "why",
        "how",
        "what",
        "which",
        "who",
        "whom",
        "whose",
        "this",
        "that",
        "these",
        "those",
        "i",
        "you",
        "he",
        "she",
        "it",
        "we",
        "they",
        "me",
        "him",
        "her",
        "us",
        "them",
        "my",
        "your",
        "his",
        "its",
        "our",
        "their",
        "mine",
        "yours",
        "hers",
        "ours",
        "theirs",
        "to",
        "of",
        "in",
        "on",
        "at",
        "by",
        "from",
        "with",
        "about",
        "above",
        "after",
        "again",
        "against",
        "all",
        "am",
        "as",
        "any",
        "around",
        "because",
        "before",
        "below",
        "between",
        "both",
        "during",
        "each",
        "few",
        "further",
        "here",
        "into",
        "just",
        "no",
        "not",
        "now",
        "once",
        "only",
        "other",
        "out",
        "over",
        "own",
        "same",
        "some",
        "such",
        "than",
        "too",
        "under",
        "until",
        "up",
        "very",
        "while",
        "through",
    ]
)


class SnippetText(BaseModel):
    snippet: str


class AhHaSnippet(BaseModel):
    id: Optional[int] = None
    title: str
    content: str
    permalink_to_origin: Optional[str] = None  # Renamed from original_context
    notes: Optional[str] = None  # Added for user notes
    generated_tags: Optional[List[str]] = None  # Added for AI-generated tags
    timestamp: Optional[datetime.datetime] = None


@app.post("/api/v1/snippets", response_model=AhHaSnippet)  # Changed path here
async def create_ah_ha(snippet: AhHaSnippet):
    global next_id
    snippet.id = next_id
    next_id += 1
    snippet.timestamp = datetime.datetime.now()

    # Generate tags with Gemini
    print(f"Attempting to generate tags for: '{snippet.title}'")
    if GEMINI_API_KEY and snippet.content:
        print(
            "GEMINI_API_KEY found and snippet content exists. Proceeding with tag generation."
        )
        try:
            model = genai.GenerativeModel("gemini-1.5-flash-latest")
            prompt = f'Suggest 3-5 relevant tags for the following text. Output them as a comma-separated list. Text: "{snippet.title} - {snippet.content}"'
            print(f"Gemini Prompt: {prompt}")
            response = await model.generate_content_async(prompt)
            print(f"Gemini Raw Response: {response.text}")
            if response.text:
                raw_tags = response.text.split(",")
                parsed_tags = [tag.strip().lower() for tag in raw_tags if tag.strip()]
                snippet.generated_tags = parsed_tags
                print(f"Parsed Tags: {snippet.generated_tags}")
            else:
                print("Gemini response was empty. No tags generated.")
                snippet.generated_tags = []
        except Exception as e:
            print(f"ERROR generating tags with Gemini: {e}")
            snippet.generated_tags = []  # Default to empty list on error
    else:
        if not GEMINI_API_KEY:
            print("GEMINI_API_KEY not found. Skipping AI tag generation.")
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
            )  # Search in generated_tags
            or search_lower in s.content.lower()
            or (s.notes and search_lower in s.notes.lower())  # Search in notes
        ]
    return sorted(ah_ha_storage, key=lambda x: x.timestamp, reverse=True)


@app.get("/ah-has/{ah_ha_id}/", response_model=AhHaSnippet)
async def get_ah_ha_by_id(ah_ha_id: int):
    for s in ah_ha_storage:
        if s.id == ah_ha_id:
            return s
    return {
        "error": "Ah-ha not found"
    }  # This will cause a validation error, ideally use HTTPException


# Mocked chat data for the demo
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
    snippet = request.snippet
    if not snippet or len(snippet.split()) < 3:  # Basic check for very short snippets
        return {"suggested_tags": []}

    # 1. Lowercase
    text = snippet.lower()

    # 2. Remove punctuation (simple replacement)
    import re

    text = re.sub(r"[^\w\s]", "", text)  # Keep words and spaces

    # 3. Tokenize
    words = text.split()

    # 4. Filter stop words and short words
    min_word_length = 3
    keywords = [
        word
        for word in words
        if word not in STOP_WORDS and len(word) >= min_word_length
    ]

    # 5. Frequency count and select top N unique words
    from collections import Counter

    if not keywords:
        return {"suggested_tags": []}

    word_counts = Counter(keywords)
    top_n = 7
    # Get unique tags, preserving order of most common
    suggested_tags = []
    for word, _ in word_counts.most_common():
        if len(suggested_tags) < top_n:
            suggested_tags.append(word)
        else:
            break

    return {"suggested_tags": suggested_tags}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8010)
