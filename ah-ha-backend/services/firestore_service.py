from google.cloud import firestore

db = None
try:
    # Always attempt to initialize the client.
    # If GOOGLE_APPLICATION_CREDENTIALS is set, it will use that.
    # If not set, it will attempt to use Application Default Credentials (ADC).
    db = firestore.Client()
    print(
        "Firestore client initialized successfully (attempted with ADC or GOOGLE_APPLICATION_CREDENTIALS if set)."
    )
except Exception as e:
    print(f"ERROR: Failed to initialize Firestore client: {e}")
    print(
        "Ensure your Google Cloud project is correctly configured and that you have authenticated via 'gcloud auth application-default login' if not using a service account JSON."
    )
    db = None  # Ensure db is None if initialization fails


def get_db():
    return db
