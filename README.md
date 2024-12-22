# Bus Tracker

**Bus Tracker** is an application for tracking public transport vehicles that
leverages open data published by transport authorities, operators and services.

## Project architecture

| Component     | Description                                                                       |
| ------------- | --------------------------------------------------------------------------------- |
| `apps/client` | The website application (React + Vite).                                           |
| `apps/server` | The main server processing incoming data (Hono server).                           |
| `libraries/*` | Libraries sharing common knowledge and logic across apps and providers.           |
| `providers/*` | Providers whose responsibility are to publish data to be processed by the server. |
