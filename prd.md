# Product Requirements Document: Gygax

## Overview

### Project Name
Gygax

### One-Line Description
Gygax is a web application that allows a Dungeon Master to host a D&D game online for a group of players.

### Problem Statement
Currently most pen and paper D&D games are played via Discord.

### Target Users
<!-- Who will use this? Be specific. -->

---

## Technical Specifications

### Tech Stack
- **Language:** <!-- e.g., TypeScript, Python, Go, Rust -->
- **Runtime/Framework:** <!-- e.g., Node.js, FastAPI, Gin -->
- **Database:** <!-- if applicable -->
- **Other Dependencies:** <!-- key libraries or tools -->

### Project Type
<!-- CLI tool | Web app | API service | Library | Other -->

### Platform/Environment
<!-- Where will this run? macOS, Linux, Docker, browser, etc. -->

---

## Core Features

### MVP Features (Must Have)
<!-- List the essential features for v1.0 -->
1. Users can login to the system with an email and password, or a magic link sent to their email.
2. Users can start a game and become a Dungeon Master for the session.
3. Users can join an existing game as a Player.
4. The DM and Players are represented as cards arranged vertically on the right edge of the screen.
5. The Players and Dungeon Master can communicate via a chat window at the bottom of the screen.
6. The Players and DM can see a map representation of the game world created by the DM.
7. DMs can edit maps.
8. Players can explore the map and expreience a fog of war effect where undiscovered terrain is obscured.
9. Maps are represented by a hexagonal grid when outdoors and a square grid when indoors.
10. Maps are viewed from an overhead perspective.
11. The application is designed to be used at first with the Moldavy B/X rule set.
12. The DM can design random encounter charts and assign them to an area.
13. The players can experience random encounters while exploring a map (indoor or outdoor).
14. A game session can be paused by the DM and persists until the next game session
15. Players and the DM can also communicate by audio.
16. The DM should be able to private message any player back and forth.
17. The chat windows (main or private) should allow the players to doll with a command like /roll 3d6+1.
18. The DM should be able to place static encounters on the map in addition to the random encounters.
19. Encounters can be both friendly or hostile.
10. Players and teh DM should be able to input their character name and an avatar image.

### Nice-to-Have Features
<!-- Features that can wait for later versions -->
1.
2.

---

## Functional Requirements

### Inputs
Group chat with all players and the DM.
Private chat from the DM to an individual player or group of players.

### Outputs
<!-- What does the system produce/return? -->

### Key User Flows
<!-- Describe the main ways users interact with the system -->

#### Flow 1: [Name]
1.
2.
3.

---

## Non-Functional Requirements

### Performance
<!-- Any speed, latency, or throughput requirements? -->

### Security
<!-- Authentication, authorization, data handling requirements -->

### Constraints
<!-- Limitations, compatibility requirements, or restrictions -->

---

## Project Structure

### Preferred Architecture
<!-- Monolith, microservices, modular, etc. -->

### Key Directories
<!-- Describe the intended folder structure if you have preferences -->
```
/src
/tests
/docs
```

---

## Success Criteria

### Definition of Done
<!-- How do we know when the MVP is complete? -->
- [ ]
- [ ]
- [ ]

### Testing Requirements
<!-- Unit tests, integration tests, manual testing, etc. -->

---

## Open Questions
<!-- List any decisions that still need to be made -->
1.
2.

---

## References
<!-- Links to designs, APIs, similar projects, or documentation -->
-

