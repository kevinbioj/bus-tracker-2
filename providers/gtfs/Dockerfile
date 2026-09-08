# Build from the repository root: docker build -f providers/gtfs/Dockerfile -t bus-tracker-gtfs .

FROM node:26.7.0-alpine AS base
RUN npm install -g --force corepack@latest
RUN corepack enable

#####################################
# STAGE 1 - Build project artifacts #
#####################################

FROM base AS build
WORKDIR /bus-tracker

# Install project dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch
COPY libraries/contracts/ ./libraries/contracts/
COPY libraries/monitoring/ ./libraries/monitoring/
COPY providers/gtfs/ ./providers/gtfs/
RUN pnpm install --offline --filter "@bus-tracker/processor-gtfs..."

# Build project artifacts
RUN pnpm --filter "@bus-tracker/processor-gtfs..." run build
RUN pnpm deploy --legacy --filter=@bus-tracker/processor-gtfs --prod gtfs-deployment

#####################################
# STAGE 2 - Run project artifacts   #
#####################################

FROM base
WORKDIR /bus-tracker

COPY --from=build /bus-tracker/gtfs-deployment/node_modules ./node_modules/
COPY --from=build /bus-tracker/gtfs-deployment/dist ./dist/
COPY --from=build /bus-tracker/gtfs-deployment/package.json ./package.json

ENV NODE_ENV=production
ENV CONFIGURATION_PATH=/opt/gtfs-processor/configuration.mjs
CMD ["node", "--expose-gc", "--enable-source-maps", "dist/index.js"]
