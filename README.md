# Tech Trek 2026 — SDMIT Campus Treasure Hunt Engine

> **SparDhaM 2026 presents Tech Trek**  
> An interactive full-stack technical treasure hunt web platform and 3D digital-twin campus viewer for **SDM Institute of Technology (SDMIT)**, Ujire, Karnataka, India.

---

## 🏛️ Event Overview
- **Event:** Tech Trek (Technical Treasure Hunt)
- **Fest:** SparDhaM 2026
- **Date:** 30/10/2026
- **Venue:** SDM Institute of Technology (SDMIT), Ujire
- **Team Size:** 3–4 Members per Team (Capacity default: 5 Teams)

---

## 🌟 Core Architecture & Features

### 1. Participant Journey
- **Step 1 — Player & Team Access:** Dark, gold-accented access modal with fixed read-only event username (`SparDhaM2026`), secure team access key entry with show/hide toggle, loading indicators, and server-enforced rate limiting.
- **Step 2 — Team Name Registration:** 3–30 character team identity registration with whitespace trimming, allowed character sanitization, and case-insensitive duplicate prevention. Authenticating again with the same access key seamlessly restores existing hunt progress.
- **Step 3 — Mission Briefing:** Themed mission intro screen featuring the official SparDhaM 2026 Tech Trek creed: *“Observe your surroundings. Follow the clues. Discover what’s hidden.”*
- **Step 4 — Live Hunt Arena:** Backend-enforced sequential clues. Unpublished draft clues are strictly withheld by the server and never sent over the wire. Includes clue number tracking, physical checkpoint requirements, QR code / verification code validation, and victory state detection.

### 2. 3D Campus Digital Twin (`/3d-campus`)
- Interactive Three.js campus model viewer using the authentic Blender campus model (`public/models/sdmit_campus.glb`).
- Aspect-ratio responsive camera calculation, single-finger orbit, two-finger pan, and pinch zoom.
- Floating action dock for view resets, full-resolution 2D floor plans, and fullscreen inspection.

### 3. Administrator & Coordinator Portal (`/admin`)
- **Dashboard Overview:** Real-time metrics on team slots, registered teams, active access keys, published clues, checkpoint visits, and live audit stream.
- **Team Slot & Key Management:** Dynamic slot creation up to configured capacity, single-view access key generator (`TT-XXXXXX`), key revocation, coordinator team renaming, and progress resets. Stored keys are protected using SHA-256 cryptographic hashes.
- **Clue Management:** Rich clue authoring, sequence reordering (move up/down), draft vs. published toggling, checkpoint linkage, and participant-view preview modal.
- **Checkpoint Management:** Physical campus checkpoint registry, auto-generated verification codes (`CK-XXXX`), high-resolution QR codes, printable checkpoint placards, and coordinator manual override.
- **Event Settings:** Configurable event name, max team capacity (2–20), progression mode (`manual` vs. `checkpoint`), and event lifecycle status (`preparation`, `active`, `finished`).
- **Immutable Audit Trail & CSV Export:** Chronological record of administrative and participant activities. Includes secure CSV export protected against CSV formula injection (`=`, `+`, `-`, `@` neutralization).

### 4. Local File-Based Persistence (Zero External Database)
- **No external SQL or NoSQL database required:** Stored cleanly in local JSON files inside `data/`.
- **Atomic file writes:** Temp file + atomic rename strategy (`writeJsonAtomic`) eliminates corrupted or partial writes.
- **Serialized write queue:** Prevents concurrent write race conditions.
- **Safe initialization:** Does not overwrite existing event records on server reboot.
- **Git exclusion:** `data/` and `.env` are included in `.gitignore` to prevent credential or participant leaks.

---

## 💻 Getting Started Locally

### Prerequisites
- **Node.js:** v18.0.0 or higher recommended
- **npm:** v9.0.0 or higher

### Installation & Environment Setup
```bash
# 1. Navigate to the project directory
cd tech-trek-campus-viewer

# 2. Install dependencies
npm install

# 3. Create your local environment configuration
cp .env.example .env
```

### Starting the Application
To run the Express backend API (port 3001) and Vite frontend (port 5173) simultaneously:
```bash
npm run dev
```

The application will be accessible at:
- **Participant Site:** [http://localhost:5173/](http://localhost:5173/)
- **3D Campus Digital Twin:** [http://localhost:5173/3d-campus](http://localhost:5173/3d-campus)
- **Coordinator Portal:** [http://localhost:5173/admin](http://localhost:5173/admin)
- **Backend Health Check:** [http://localhost:3001/api/health](http://localhost:3001/api/health)

---

## 🔑 Administrator Access & First-Time Setup

1. Navigate to [http://localhost:5173/admin](http://localhost:5173/admin).
2. Enter the temporary bootstrap credentials:
   - **Username:** `SHREYASH`
   - **Initial Password:** `1905`
3. **Mandatory Password Change:** On first login, the platform will automatically prompt you to establish a new password (minimum 6 characters). All administrative features are locked by the backend until this step is completed.
4. Subsequent logins will require your newly chosen password.

### Generating & Issuing Team Access Keys
1. In the Coordinator Portal, navigate to the **Access Keys** tab.
2. Select **Generate Key** next to an available team slot (e.g., Slot #1).
3. Copy the generated key (e.g., `TT-7X9K2M`).
   > **Note:** For security, the plaintext key is displayed only once upon generation. The server stores only its cryptographic SHA-256 hash.
4. Provide the key to the team coordinator on competition day.

### Authoring Clues & Checkpoints
1. **Create Checkpoints:** In the **Checkpoints** tab, click **Add Checkpoint**. Enter the location name (e.g., *Ground Floor Courtyard*) and notes. Click **View QR** to display or print the QR placard.
2. **Author Clues:** In the **Manage Hints** tab, click **Create Clue**. Enter your technical riddle, optionally link it to a physical checkpoint, and set the status to `Published` when ready for teams to view.

---

## 💾 Event Data Storage & Backup Procedures

### Storage Locations
Event state is maintained locally in the project root:
- `data/event_state.json`: Active team slots, progress indices, published clues, and checkpoints.
- `data/admin_auth.json`: Administrator credentials (bcrypt hashed) and active session records.
- `data/audit_logs.json`: Chronological audit trail of all event actions.

### Backing Up Event Data
To create a snapshot backup before or during competition:
```bash
# Create a timestamped backup directory
mkdir -p backups/$(date +%Y%m%d_%H%M%S)
cp -r data/ backups/$(date +%Y%m%d_%H%M%S)/
```

### Restoring Event Data
To restore from a previous backup:
```bash
cp backups/<backup_folder>/*.json data/
```

---

## ☁️ Deployment Considerations

### What is Ready
- Frontend bundle builds cleanly via `npm run build`.
- Backend runs standalone via `node server/index.js` or `npm run server`.
- Express backend serves consistent JSON APIs with rate limiting, security headers (`X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`), and input sanitization.

### Important Hosting Limitation (Ephemeral Storage)
- Local JSON persistence relies on the local filesystem.
- Free-tier cloud platforms (such as basic Render web services) frequently use **ephemeral filesystems**, meaning local files in `data/` may reset during dyno/container restarts unless a persistent disk volume is mounted.
- For permanent cloud deployment, mount a persistent disk volume to `/data` or configure remote backup syncing.

---

## 📜 License & Attribution
Developed for SparDhaM 2026 · SDM Institute of Technology (SDMIT), Ujire. All rights reserved.
