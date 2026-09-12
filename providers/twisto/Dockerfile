# Build from the repository root: docker build -f providers/twisto/Dockerfile -t bus-tracker-twisto .

FROM node:26.8.2-alpine AS base
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
COPY providers/twisto/ ./providers/twisto/
RUN pnpm install --offline --filter "@bus-tracker/processor-twisto..."

# Build project artifacts
RUN pnpm --filter "@bus-tracker/processor-twisto..." run build
RUN pnpm deploy --legacy --filter=@bus-tracker/processor-twisto --prod twisto-deployment

#####################################
# STAGE 2 - Run project artifacts   #
#####################################

FROM base
WORKDIR /bus-tracker

COPY --from=build /bus-tracker/twisto-deployment/node_modules ./node_modules/
COPY --from=build /bus-tracker/twisto-deployment/dist ./dist/
COPY --from=build /bus-tracker/twisto-deployment/package.json ./package.json

ENV NODE_ENV=production
CMD ["node", "--expose-gc", "--enable-source-maps", "dist/index.js"]
