from google.cloud import firestore_v1 as firestore  # Use firestore_v1 for AsyncClient

db = None
try:
    # Always attempt to initialize the client.
    # If GOOGLE_APPLICATION_CREDENTIALS is set, it will use that.
    # If not set, it will attempt to use Application Default Credentials (ADC).
    db = firestore.AsyncClient()  # Changed to AsyncClient
    print(
        "Firestore client initialized successfully (attempted with ADC or GOOGLE_APPLICATION_CREDENTIALS if set)."
    )
except Exception as e:
    print(f"ERROR: Failed to initialize Firestore client: {e}")
    print(
        "Ensure your Google Cloud project is correctly configured and that you have authenticated via 'gcloud auth application-default login' if not using a service account JSON."
    )
    db = None  # Ensure db is None if initialization fails


import datetime
from typing import List, Optional

from models import AhHaSnippet  # Assuming AhHaSnippet is in models.py

SNIPPETS_COLLECTION = "ah_ha_snippets"


def get_db():
    return db


async def create_snippet(snippet_data: AhHaSnippet) -> AhHaSnippet:
    """Creates a new snippet in Firestore."""
    if not db:
        raise ConnectionError("Firestore client not initialized.")

    # Firestore will auto-generate an ID for the new document
    doc_ref = db.collection(SNIPPETS_COLLECTION).document()

    # Prepare data for Firestore (Pydantic model to dict)
    # Ensure timestamp is a Firestore-compatible timestamp
    snippet_dict = snippet_data.model_dump(exclude_none=True)
    snippet_dict["id"] = doc_ref.id  # Use Firestore's generated ID
    if isinstance(snippet_dict.get("timestamp"), datetime.datetime):
        snippet_dict["timestamp"] = (
            firestore.SERVER_TIMESTAMP
        )  # Let Firestore set the server timestamp
    else:
        # If timestamp is not a datetime object (e.g. already a string from client),
        # ensure it's handled or converted appropriately, or set to server time.
        # For simplicity, we'll use server timestamp if not already a proper datetime.
        snippet_dict["timestamp"] = firestore.SERVER_TIMESTAMP

    await doc_ref.set(snippet_dict)

    # Fetch the document to get server-generated timestamp and ensure all fields are present
    created_doc = await doc_ref.get()
    if created_doc.exists:
        data = created_doc.to_dict()
        if data and "title" in data and "content" in data:  # Ensure required fields
            # Pydantic will handle optional fields if not present in data
            return AhHaSnippet(**data)
        else:
            print(
                f"Firestore document {doc_ref.id} created but missing required fields upon retrieval. Data: {data}"
            )
            # Fallback or raise error, for now returning based on input + ID
            # This indicates a potential issue with data consistency or Firestore behavior
            return snippet_data.model_copy(update={"id": doc_ref.id})
    else:
        # This case should ideally not happen if .set() was successful
        raise ConnectionError(
            f"Failed to retrieve snippet {doc_ref.id} after creation."
        )


async def get_snippet_by_id(snippet_id: str) -> Optional[AhHaSnippet]:
    """Retrieves a snippet by its Firestore document ID."""
    if not db:
        raise ConnectionError("Firestore client not initialized.")

    doc_ref = db.collection(SNIPPETS_COLLECTION).document(snippet_id)
    doc = await doc_ref.get()
    if doc.exists:
        data = doc.to_dict()
        # Ensure required fields are present, Pydantic will validate types
        if data and "title" in data and "content" in data:
            return AhHaSnippet(**data)
        else:
            # Log an error or handle missing critical fields
            print(
                f"Firestore document {snippet_id} is missing required fields (title, content). Data: {data}"
            )
            return None
    return None


async def get_all_snippets(search_term: Optional[str] = None) -> List[AhHaSnippet]:
    """Retrieves all snippets, optionally filtered by a search term."""
    if not db:
        raise ConnectionError("Firestore client not initialized.")

    query_ref = db.collection(
        SNIPPETS_COLLECTION
    ).order_by(  # Changed variable name from query to query_ref for clarity
        "timestamp", direction=firestore.Query.DESCENDING
    )

    snippets = []
    async for doc in query_ref.stream():
        data = doc.to_dict()
        if data and "title" in data and "content" in data:  # Ensure required fields
            snippet = AhHaSnippet(**data)  # Pydantic handles optional fields
            if search_term:
                search_lower = search_term.lower()
                # Ensure all searchable fields are checked safely
                title_match = search_lower in snippet.title.lower()
                content_match = search_lower in snippet.content.lower()
                tags_match = False
                if snippet.generated_tags:  # Check if tags exist
                    tags_match = any(
                        search_lower in tag.lower() for tag in snippet.generated_tags
                    )
                notes_match = False
                if snippet.notes:  # Check if notes exist
                    notes_match = search_lower in snippet.notes.lower()

                if title_match or content_match or tags_match or notes_match:
                    snippets.append(snippet)
            else:
                snippets.append(snippet)
        else:
            # Log an error or handle missing critical fields for a document in the list
            print(
                f"Firestore document {doc.id} in get_all_snippets is missing required fields (title, content). Data: {data}"
            )

    return snippets
