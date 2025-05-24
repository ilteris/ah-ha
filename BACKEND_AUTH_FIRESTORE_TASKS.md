## Backend Implementation Tasks: Google OAuth & Firestore

### 1. Setup & Configuration

*   [ ] **1.1.** Identify and list required Python libraries: `google-auth`, `google-auth-oauthlib`, `python-jose[cryptography]`, `google-cloud-firestore`, `passlib[bcrypt]`.
*   [ ] **1.2.** Define environment variables for Google OAuth, JWTs, and Firestore (e.g., `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `JWT_SECRET_KEY`, `JWT_ALGORITHM`, `API_ACCESS_TOKEN_EXPIRE_MINUTES`, `API_REFRESH_TOKEN_EXPIRE_DAYS`, `GOOGLE_APPLICATION_CREDENTIALS`).
*   [ ] **1.3.** Implement loading of environment variables in `main.py` (using `python-dotenv`).
*   [ ] **1.4.** Initialize Firestore client (`db = firestore.Client()`) in `main.py` using `GOOGLE_APPLICATION_CREDENTIALS`.
*   [ ] **1.5.** (Optional) Define Pydantic `Settings` model for complex configurations.

### 2. Google OAuth Endpoints & Initial Token Issuance

*   [ ] **2.1.** Implement `GET /auth/google/login` endpoint:
  *   [ ] **2.1.1.** Construct Google OAuth authorization URL (using `google_auth_oauthlib.flow.Flow`).
  *   [ ] **2.1.2.** Define scopes (e.g., `openid`, `email`, `profile`).
  *   [ ] **2.1.3.** Implement redirect to Google.
*   [ ] **2.2.** Implement `GET /auth/google/callback` endpoint:
  *   [ ] **2.2.1.** Receive `authorization_code` from Google.
  *   [ ] **2.2.2.** Exchange code for Google's tokens (`flow.fetch_token()`).
  *   [ ] **2.2.3.** Validate Google's ID token (`google.oauth2.id_token.verify_oauth2_token`) for user details.
  *   [ ] **2.2.4.** Implement user provisioning/lookup in Firestore (see 5.2).
  *   [ ] **2.2.5.** Issue API-specific access and refresh tokens (see 3.1, 3.2).
  *   [ ] **2.2.6.** Store API refresh token in Firestore (see 5.3, 3.4).
  *   [ ] **2.2.7.** Implement redirect mechanism to return API tokens to client (for `launchWebAuthFlow`).

### 3. API Token Management (Helpers & Models)

*   [ ] **3.1.** Create helper function `create_api_access_token(data: dict, expires_delta: timedelta = None)`.
*   [ ] **3.2.** Create helper function `create_api_refresh_token(data: dict, expires_delta: timedelta = None)`.
*   [ ] **3.3.** Define Pydantic model `TokenData` for API access token payload.
*   [ ] **3.4.** If hashing API refresh tokens: define `verify_password` and `get_password_hash` utilities (using `passlib`).

### 4. API Refresh & Logout Endpoints

*   [ ] **4.1.** Implement `POST /auth/refresh` endpoint:
  *   [ ] **4.1.1.** Define Pydantic request model (for `refresh_token`).
  *   [ ] **4.1.2.** Validate received API refresh token against Firestore storage.
  *   [ ] **4.1.3.** If valid, issue new API access token.
  *   [ ] **4.1.4.** (Optional) Implement API refresh token rotation (invalidate old, issue/store new).
  *   [ ] **4.1.5.** Define Pydantic response model (for new `access_token`, optional new `refresh_token`).
  *   [ ] **4.1.6.** Handle invalid/expired refresh token (return `401`).
*   [ ] **4.2.** Implement `POST /auth/logout` endpoint:
  *   [ ] **4.2.1.** Define Pydantic request model (for `refresh_token`).
  *   [ ] **4.2.2.** Invalidate/delete API refresh token from Firestore.
  *   [ ] **4.2.3.** Define success response (e.g., `200 OK` or `204 No Content`).

### 5. Firestore Integration (Data Models & CRUD)

*   [ ] **5.1.** Define Pydantic models for Firestore documents:
  *   [ ] **5.1.1.** `UserInDB` (or similar) for `users` collection.
  *   [ ] **5.1.2.** `APIRefreshTokenInDB` for `api_refresh_tokens` collection.
*   [ ] **5.2.** Implement CRUD operations for `users` collection (get/create user, update `last_login_at`).
*   [ ] **5.3.** Implement CRUD operations for `api_refresh_tokens` collection (store, retrieve/validate, delete).
*   [ ] **5.4.** Modify `AhHaSnippet` Pydantic model to include `user_id`.
*   [ ] **5.5.** Update snippet CRUD operations to use Firestore and be user-specific.

### 6. Secure Existing API Endpoints

*   [ ] **6.1.** Define FastAPI dependency `get_current_active_user`:
  *   [ ] **6.1.1.** Use `OAuth2PasswordBearer` or custom logic for Bearer token extraction.
  *   [ ] **6.1.2.** Decode and validate API access token (signature, expiry, claims).
  *   [ ] **6.1.3.** Extract `user_id` (via `TokenData`).
  *   [ ] **6.1.4.** (Optional) Fetch full user from Firestore.
  *   [ ] **6.1.5.** Raise `HTTPException` (401) on failure.
*   [ ] **6.2.** Apply `get_current_active_user` dependency to all relevant snippet endpoints.
*   [ ] **6.3.** Ensure `user_id` from token is used for data access in protected endpoints.

### 7. Finalize Dependencies & Documentation

*   [ ] **7.1.** Update `ah-ha-backend/requirements.txt` with all new libraries.
*   [ ] **7.2.** Create/update `.env.example` with all new environment variables.
*   [ ] **7.3.** (Self-correction) Ensure Pydantic models for request/response bodies are defined for all new auth endpoints.
