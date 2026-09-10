# Build from the repository root: docker build -f providers/idelis/Dockerfile -t bus-tracker-idelis .

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
COPY providers/idelis/ ./providers/idelis/
RUN pnpm install --offline --filter "@bus-tracker/processor-idelis..."

# Build project artifacts
RUN pnpm --filter "@bus-tracker/processor-idelis..." run build
RUN pnpm deploy --legacy --filter=@bus-tracker/processor-idelis --prod idelis-deployment

#####################################
# STAGE 2 - Run project artifacts   #
#####################################

FROM base
WORKDIR /bus-tracker

COPY --from=build /bus-tracker/idelis-deployment/node_modules ./node_modules/
COPY --from=build /bus-tracker/idelis-deployment/dist ./dist/
COPY --from=build /bus-tracker/idelis-deployment/package.json ./package.json

ENV NODE_ENV=production
ENTRYPOINT ["node", "--enable-source-maps", "dist/index.js"]
