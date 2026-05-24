# Backend Technical Specification (Cloudflare Workers + MongoDB Atlas Data API)

## 1. Architectural Overview
The backend operates as a stateless REST API deployed on Cloudflare Workers. It acts as an API gateway and business logic validator that translates incoming client HTTPS requests into standard MongoDB Atlas Data API HTTP commands (`findOne`, `insertOne`, `updateOne`, `deleteOne`).

---

## 2. Data Model & Database Operations

### 2.1 MongoDB Atlas Schema Structures

**Collection: `instructors`**
```json
{
  "_id": {"$oid": "645f782c9f1a..."},
  "username": "prof_smith",
  "passwordHash": "$2b$10$...",
  "instructorToken": "st_5a2f8c9b3e10...",
  "createdAt": {"$date": "2026-05-23T19:00:00.000Z"}
}
```

**Collection: `plans`**
```json
{
  "_id": {"$oid": "821a782c9f1a..."},
  "instructorToken": "st_5a2f8c9b3e10...",
  "title": "Data Structures 101",
  "questions": [
    {
      "questionId": "q_1716490800",
      "text": "What is the time complexity of a binary search tree lookup in the worst case?",
      "choices": ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
      "timeLimit": 60,
      "correctChoiceIndex": 1
    }
  ]
}
```

**Collection: `sessions` (Ephemeral Rooms)**
```json
{
  "_id": {"$oid": "645f782c9f1a2c3b4e5f6a7b"},
  "roomCode": "NXKB",
  "instructorToken": "st_5a2f8c9b3e10...",
  "planId": "821a782c9f1a...", 
  "status": "active",
  "createdAt": {"$date": "2026-05-23T19:00:00.000Z"},
  "questions": [
    {
      "questionId": "q_1716490800",
      "text": "What is the time complexity of a binary search tree lookup in the worst case?",
      "choices": ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
      "timeLimit": 60,
      "correctChoiceIndex": 1,
      "isActive": true,
      "startedAt": {"$date": "2026-05-23T19:15:00.000Z"},
      "votes": { 
        "student_5f8a9": 2, 
        "student_1b2c3": 1 
      }
    }
  ]
}
```

---

## 3. Deep Module: Database Client Interface (`backend/src/db/`)
Following the project's strict architectural guidelines, database connectivity is encapsulated inside a deep module.

- **Public Interface (`backend/src/db/index.ts`):** Exports clean async functions handling specific domain tasks.
- **Private Components (`backend/src/db/Private/`):** Houses Atlas Data API endpoint invocation mechanics.
- All public functions are limited to a maximum of 3 parameters. Extended payloads wrap parameters into atomic configuration objects.

---

## 4. REST API Endpoint Catalog

### 4.1 Instructor Domain

#### `POST /api/instructors/register`
- **Description:** Registers a new instructor account.
- **Payload:** `{ username, password }`
- **Database Action:** Creates an entry returning an `instructorToken`.

### 4.2 Plan Management Domain

#### `GET /api/plans`
- **Description:** Lists all plans created by the instructor.
- **Headers:** `Authorization: Bearer <instructorToken>`
- **Database Action:** `find` matching the `instructorToken`, returning projected metadata (e.g., title, id).

#### `POST /api/plans`
- **Description:** Creates a reusable class plan.
- **Headers:** `Authorization: Bearer <instructorToken>`
- **Payload:** `{ title: string }`
- **Database Action:** `insertOne` returning the new `planId`.

#### `GET /api/plans/:planId`
- **Description:** Visualizes a specific plan and its full catalogue of questions.
- **Headers:** `Authorization: Bearer <instructorToken>`
- **Database Action:** `findOne` matching `planId`.

#### `DELETE /api/plans/:planId`
- **Description:** Deletes a complete plan.
- **Headers:** `Authorization: Bearer <instructorToken>`
- **Database Action:** `deleteOne` matching `planId`.

#### `POST /api/plans/:planId/questions`
- **Description:** Adds a predefined question to a plan.
- **Headers:** `Authorization: Bearer <instructorToken>`
- **Payload:** `{ text: string, choices: string[], timeLimit?: number, correctChoiceIndex?: number }`
- **Database Action:** `updateOne` using `$push`.

#### `DELETE /api/plans/:planId/questions/:questionId`
- **Description:** Removes a specific question from a plan's catalogue.
- **Headers:** `Authorization: Bearer <instructorToken>`
- **Database Action:** `updateOne` using `$pull` on the questions array.

### 4.3 Session (Room) Management Domain

#### `POST /api/sessions`
- **Description:** Initializes an active ephemeral room, optionally linked to a plan.
- **Headers:** `Authorization: Bearer <instructorToken>`
- **Payload:** `{ planId?: string }`
- **Database Action:** `insertOne`. Generates a 4-character `roomCode`. Copies the plan's questions into the session with `isActive: false` and `votes: {}`.

#### `POST /api/sessions/:roomCode/questions/custom`
- **Description:** Pushes an improvised custom question to the live room.
- **Headers:** `Authorization: Bearer <instructorToken>`
- **Payload:** `{ text: string, choices: string[], timeLimit?: number, correctChoiceIndex?: number }`
- **Database Action:** `updateOne` using `$push` to append the new question to the room's array. Optionally activates it immediately.

#### `POST /api/sessions/:roomCode/questions/:questionId/activate`
- **Description:** Pushes a specific question live. Injects `startedAt` timestamp if a `timeLimit` exists.
- **Headers:** `Authorization: Bearer <instructorToken>`
- **Database Action:** `updateOne` modifying the array elements so only the target `questionId` is active.

#### `POST /api/sessions/:roomCode/questions/deactivate`
- **Description:** Closes voting on the currently active question without closing the whole room.
- **Headers:** `Authorization: Bearer <instructorToken>`
- **Database Action:** `updateOne` setting `isActive = false` where `isActive == true`.

#### `GET /api/sessions/:roomCode/stats`
- **Description:** Fetches complete statistics and vote dictionaries for the dashboard.
- **Headers:** `Authorization: Bearer <instructorToken>`
- **Database Action:** `findOne` filtering by `roomCode`.

#### `POST /api/sessions/:roomCode/close`
- **Description:** Terminates the session completely.
- **Headers:** `Authorization: Bearer <instructorToken>`
- **Database Action:** `updateOne` setting `status = "closed"`.

### 4.4 Student Domain (Public/Anonymous)

#### `GET /api/sessions/:roomCode`
- **Description:** Polled by student clients and OBS overlay.
- **Query Params:** `?studentId=<uuid>` (optional).
- **Security Constraint:** Strips away `instructorToken` and the full `votes` object. If `studentId` is provided and the question is active, returns a vote status. Overlays should skip providing `studentId`.
- **Database Action:** `findOne` with projection.

#### `POST /api/sessions/:roomCode/vote`
- **Description:** Transmits an anonymous choice.
- **Payload:** `{ questionId: string, choiceIndex: number, studentId: string }`
- **Validation:** Verifies `status == "active"`, question `isActive == true`, and current time vs `startedAt + timeLimit`.
- **Database Action:** Atomic execution via `updateOne` utilizing `$set` to map `votes.<studentId> = choiceIndex`.
