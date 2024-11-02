# Bus Tracker

**Bus Tracker** is an application for tracking public transport vehicles that
leverages open data published by transport authorities, operators and services.

Its architecture was recently redesigned (Oct 2024) to be more resilient and
easier to maintain : the data layer is composed of many applications publishing
their own data to a Redis pub/sub channel, which are then processed by the main
server.

The website is a classic Next.js application allowing users to browse through
these data in a fun way.

## Project architecture

| Component     | Description                                                                       |
| ------------- | --------------------------------------------------------------------------------- |
| `apps/client` | The website application.                                                          |
| `apps/server` | The main server processing incoming data.                                         |
| `libraries/*` | Libraries sharing common knowledge and logic across apps and providers.           |
| `providers/*` | Providers whose responsibility are to publish data to be processed by the server. |
