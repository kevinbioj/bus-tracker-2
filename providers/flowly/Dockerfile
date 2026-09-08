# Build from the repository root: docker build -f providers/flowly/Dockerfile -t bus-tracker-flowly .

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
COPY providers/flowly/ ./providers/flowly/
RUN pnpm install --offline --filter "@bus-tracker/processor-flowly..."

# Build project artifacts
RUN pnpm --filter "@bus-tracker/processor-flowly..." run build
RUN pnpm deploy --legacy --filter=@bus-tracker/processor-flowly --prod flowly-deployment

#####################################
# STAGE 2 - Run project artifacts   #
#####################################

FROM base
WORKDIR /bus-tracker

COPY --from=build /bus-tracker/flowly-deployment/node_modules ./node_modules/
COPY --from=build /bus-tracker/flowly-deployment/dist ./dist/
COPY --from=build /bus-tracker/flowly-deployment/package.json ./package.json

ENV NODE_ENV=production

# The flowly id and network ref are positional arguments, not environment variables.
ENTRYPOINT ["node", "--enable-source-maps", "dist/index.js"]
