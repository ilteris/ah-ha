import os

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Vertex AI / ADK Configuration
GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
GOOGLE_CLOUD_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION")
GOOGLE_GENAI_MODEL = os.getenv(
    "GOOGLE_GENAI_MODEL", "gemini-2.0-flash"
)  # Added from generate_tags_tool

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")

# JWT Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
API_ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("API_ACCESS_TOKEN_EXPIRE_MINUTES", "30")
)
API_REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("API_REFRESH_TOKEN_EXPIRE_DAYS", "7"))

# CORS Configuration
ORIGINS = [
    "http://localhost",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    # Add any other origins if your frontend runs on a different port/domain
]

# Stop words list (can be expanded) - Moving here as it's a static configuration
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
