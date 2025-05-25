import datetime
from typing import List, Optional

from pydantic import BaseModel


class SnippetText(BaseModel):
    snippet: str


class AhHaSnippet(BaseModel):
    id: Optional[str] = None  # Firestore IDs are strings
    title: str
    content: str
    permalink_to_origin: Optional[str] = None
    notes: Optional[str] = None
    generated_tags: Optional[List[str]] = None
    timestamp: Optional[datetime.datetime] = None
