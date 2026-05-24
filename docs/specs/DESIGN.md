# Product Requirements Document (PRD) & Technical Specification

**Project:** ClassPolls (Ephemeral Student Interaction App)  
**Author/Developer:** Conceptual Design Stage  
**License:** GPLv3 Dual-Licensing / CC BY-NC  

---

## 1. Executive Summary & Vision

**ClassPolls** is an open-source, ultra-low friction classroom interaction tool designed to solve the "dark screen syndrome" in online education. When instructors share their screen via platforms like Discord or OBS, their ability to gauge student comprehension drops dramatically due to a lack of visual feedback.

Unlike heavy alternative solutions (e.g., Kahoot, Mentimeter) which require tedious pre-class configuration or rigid slideshow frameworks, ClassPolls prioritizes **zero-friction improvisation**. It enables instructors to plan templates ahead of time or sketch questions verbally on-the-fly, pushing them to students' browsers within two clicks. To ensure absolute psychological safety and maximum engagement, all student interactions are completely anonymous.

> **Core Development Constraint:** The entire production deployment must operate gracefully within the **100% Free Tiers** of modern serverless and cloud providers, avoiding any ongoing maintenance or computing costs while remaining highly scalable for thousands of concurrent sessions.

---

## 2. Technical Stack Specification

To satisfy the strict cost constraints ($0 USD operating cost) and eliminate deployment complexities, the following modern architecture has been selected:

| Layer | Technology Selected | Architectural Justification |
| :--- | :--- | :--- |
| **Frontend Hosting** | **Cloudflare Pages** | Provides global CDN static distribution for both the instructor dashboard, student remote view, and OBS overlays. 100% free with unlimited bandwidth. |
| **Backend Compute** | **Cloudflare Workers** | Serverless V8 isolates executing code on the network edge. Eliminates persistent server upkeep. Free tier allows 100,000 requests per day. |
| **Database Storage** | **MongoDB Atlas (M0 Free Tier)** | Provides a flexible JSON document structure perfectly fitting schema evolution. Free tier offers 512 MB of storage, sufficient for thousands of text-only sessions. |
| **Communication Protocol** | **HTTP Client Polling (3s)** | Bypasses complex WebSocket state tracking on serverless infrastructures. Seamlessly bypasses strict educational/corporate network firewalls. Low query metrics fit free limits safely. |

---

## 3. System Architecture & Lifecycle Model

### 3.1 The Ephemeral Session Architecture
To preserve simplicity and data privacy, ClassPolls operates strictly on an **ephemeral room model**. Virtual rooms are created dynamically when an instructor clicks "Start Class," and completely dissolve upon termination. Live data calculations stay structured within single active collection entries, removing multi-table joins or distributed state sync issues.

### 3.2 Database Schema Design
The entire history, configurations, and current live voting state are combined into a single, cohesive document within the `sessions` collection:

```json
{
  "_id": "ObjectId('645f782c9f1a2c3b4e5f6a7b')",
  "roomCode": "NXKB",
  "instructorId": "prof_90218",
  "status": "active",
  "createdAt": "2026-05-23T19:00:00Z",
  "questions": [
    {
      "questionId": "q_1716490800",
      "text": "Did you understand the inheritance structure shown in the code?",
      "type": "si_no",
      "votes": { "Yes": 14, "No": 3 },
      "isActive": false
    },
    {
      "questionId": "q_1716491220",
      "text": "What is the time complexity of a binary search tree lookup in the worst case?",
      "type": "multiple_choice",
      "votes": { "A": 1, "B": 19, "C": 2, "D": 0 },
      "isActive": true
    }
  ]
}
```

---

## 4. Functional Requirements Specification

### 4.1 Instructor Requirements (Dashboard & Controls)
* **FR-1.1 Session Initialization:** The system must allow instructors to initiate an active room with a single click, instantly generating a unique, human-readable 4-character code (e.g., `NXKB`).
* **FR-1.2 Safe 2-Click Launch Mechanism:** To prevent accidental misclicks, publishing any question must require a distinct two-step execution pattern:
  * *Click 1 (Load/Draft):* Select a pre-saved question template (e.g., Yes/No, A/B/C/D, 1-5 Confidence Thermometer) or open a custom blank form. The system populates a staging workspace allowing text editing.
  * *Click 2 (Launch Live):* Click a "Launch Question" button to submit data updates to MongoDB, instantly declaring it active for connected clients.
* **FR-1.3 Verbal/Improvised Question Support:** The interface must allow launching template parameters without explicit body text, enabling instructors to dictate questions verbally over Discord/OBS while students interact purely with generic response keys.
* **FR-1.4 On-Demand Statistical Refresh:** The instructor dashboard must supply an asynchronous refresh option to poll total counts. The data layer will leverage atomic increment logic (`$inc`) inside MongoDB to preserve transaction safety across concurrent voters.
* **FR-1.5 Session Closure & Exfiltration:** Upon hitting "End Class", the serverless script updates room indicators to `closed`. The dashboard generates an immediate on-client download structure enabling file export (CSV / JSON Report) before data memory clearing.

### 4.2 Student Requirements (Remote Interface)
* **FR-2.1 Authentication-Free Access:** Students must access the response grid instantly by visiting the web platform and supplying the active 4-character room code. No registration, user profiles, or tracking metadata are required.
* **FR-2.2 Idle/Staging Listener State:** While the instructor has no active question pushed, the student page must enter an idle state displaying a "Waiting for the instructor..." message.
* **FR-2.3 Auto-Rendering Workspace:** Client-side polling executed every 3 seconds must automatically track variations in active question IDs. When an active item is identified, the layout must smoothly render the respective selection keys.
* **FR-2.4 Single-Vote Enforcement:** Once a choice is transmitted, selection buttons must turn disabled on the client side, showing a "Vote Registered" tag to prevent single-device spamming.

---

## 5. Non-Functional & Operational Requirements

### 5.1 Performance & Network Optimization
* **NFR-3.1 Network Latency:** Global query processing routes handled through Cloudflare Page/Worker infrastructures must guarantee API execution turnaround under 100ms.
* **NFR-3.2 Network Firewall Evasion:** By replacing persistent state pipelines (such as WebSockets) with simple standard outbound HTTPS requests, the system must reliably operate inside restrictive institutional firewalls (e.g., campus networks, corporate VPNs).

### 5.2 Privacy & Security Compliance
* **NFR-4.1 Absolute Anonymity:** The backend environment must omit tracking logs, client IPs, or long-term browser tokens. Data mutations strictly increment value summaries, assuring zero trace of individual student submission histories.
* **NFR-4.2 Open-Source Compliance:** Software architecture layout codebases will be published under a **GPLv3 Dual-Licensing Framework** (or restrictive non-commercial setup like *CC BY-NC*), preserving open-source academic flexibility while reserving rights on unapproved monetization.

### 5.3 System Stability & Garbage Collection
* **NFR-5.1 Time-To-Live (TTL) Automatic Purges:** To protect database environments from stray active rooms, MongoDB will utilize a **TTL Index** set at 4 hours past the `createdAt` timestamp, ensuring automated housecleaning and space conservation without developer intervention.