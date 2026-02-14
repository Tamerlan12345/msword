# Collabora Migration Checklist

## 1. Environment Variables
Add the following environment variables to your Railway project (or `.env` locally):

### Backend Service
*   `WOPI_HOST_URL`: The public URL of your backend service (e.g., `https://backend-production.up.railway.app`).
*   `COLLABORA_URL`: The public URL of your Collabora service (e.g., `https://collabora-production.up.railway.app`).

### Collabora Service (Docker)
*   `extra_params`: `--o:ssl.enable=false --o:ssl.termination=true` (Railway handles SSL).
*   `COLLABORA_USERNAME`: Admin username (defaults to `admin`).
*   `COLLABORA_PASSWORD`: Admin password (defaults to `admin`).
*   `aliasgroup1`: `https://.*:443` (or your specific domain `https://backend-production.up.railway.app:443`).

### Frontend Service
*   No specific WOPI variables required. The frontend now fetches the Collabora URL from the backend (`/api/wopi/iframe/:id`).

---

## 2. Verification Steps

### Step 1: Check Collabora Discovery
Visit `https://<COLLABORA_URL>/hosting/discovery`.
*   **Expected:** An XML response listing WOPI capabilities.
*   **If 404/502:** Container is not running or port 9980 is not exposed correctly.

### Step 2: Test Document Read
Open a document in the application.
*   **Expected:** The Collabora editor loads inside the iframe.
*   **Process:** Frontend calls `GET /api/wopi/iframe/:id`. Backend fetches Discovery XML from `COLLABORA_URL`, builds the correct `src` with `WOPISrc` and `access_token`, and returns it.
*   **If "Access Denied":** Check `WOPI_HOST_URL` matches the actual backend URL.
*   **If "File not found":** Check if the file exists in `uploads/` folder on the backend.

### Step 3: Test Document Write
1.  Edit the document in Collabora.
2.  Wait a few seconds (Collabora autosaves).
3.  Refresh the page or check the "Last Modified" time.
4.  **Verification:** Check the `updatedAt` timestamp in the database or the file modification time in the `uploads/` volume.
    *   *Note:* The backend uses atomic writes (writes to `.tmp` then renames) to prevent data corruption.

### Step 4: CORS & Domain Whitelisting
If the editor loads but shows a generic error:
*   Check the browser console for CORS errors.
*   Ensure `aliasgroup1` in Collabora env vars includes the domain where the Frontend/Backend is hosted.

---

## Troubleshooting
*   **Discovery Failed:** Check backend logs. If backend cannot reach `COLLABORA_URL`, it will fallback to `/browser/dist/cool.html`.
*   **Iframe Blank/Refused to Connect:** Ensure `COLLABORA_URL` uses `https` if the site is `https`. Mixed content is blocked.
*   **WOPI CheckFileInfo 404:** Ensure the `documentId` passed to the iframe exists in the database.
