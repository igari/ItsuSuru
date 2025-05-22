# ItsuSuru - Simple Schedule Coordination Tool

"ItsuSuru" (イツスル？) is a lightweight, browser-based schedule coordination tool that allows users to create events, propose dates, and collect participant availability without requiring login.

## Features

- Create events with multiple candidate dates and times
- Share event links with participants
- Collect participant responses (available, maybe, unavailable)
- View aggregated availability at a glance
- Edit events and responses
- Option to specify time per day or use a default time
- Responsive design for all devices

## Tech Stack

- Web Server: Node.js + Express
- Database: SQLite + Firestore
- Front-end: HTMX + Pure CSS + Vanilla JavaScript
- Hosting: Firebase

## Development

### Prerequisites

- Node.js v20 or later
- Firebase CLI (for deployment)

### Installation

```sh
npm install
```

### Running Locally

```sh
node server.js
```

The application will be available at http://localhost:3000

### Firebase Emulators

To run with Firebase emulators:

```sh
cd functions
npm run emulate
```

## Usage

1. Create an event by entering an event name and selecting candidate dates
2. Share the generated link with participants
3. Participants can enter their name and indicate their availability for each date
4. View the aggregated results to find the optimal date and time
