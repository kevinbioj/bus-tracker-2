# Build from the repository root: docker build -f providers/hawk/Dockerfile -t bus-tracker-hawk .

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
COPY providers/hawk/ ./providers/hawk/
RUN pnpm install --offline --filter "@bus-tracker/processor-hawk..."

# Build project artifacts
RUN pnpm --filter "@bus-tracker/processor-hawk..." run build
RUN pnpm deploy --legacy --filter=@bus-tracker/processor-hawk --prod hawk-deployment

#####################################
# STAGE 2 - Run project artifacts   #
#####################################

FROM base
WORKDIR /bus-tracker

COPY --from=build /bus-tracker/hawk-deployment/node_modules ./node_modules/
COPY --from=build /bus-tracker/hawk-deployment/dist ./dist/
COPY --from=build /bus-tracker/hawk-deployment/package.json ./package.json

ENV NODE_ENV=production

# NETWORK_REF, HAWK_ID, INFO_TOKEN and OPERATOR_REF are read from the environment.
ENTRYPOINT ["node", "--enable-source-maps", "dist/index.js"]
