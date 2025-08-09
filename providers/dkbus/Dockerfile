FROM node:22.18.0-alpine AS base
RUN corepack enable

#####################################
# STAGE 1 - Build project artifacts #
#####################################

FROM base AS build
WORKDIR /app

# Install project dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build project artifacts
COPY src/ ./src/
COPY tsconfig.json ./
RUN pnpm build

#####################################
# STAGE 2 - Run project artifacts   #
#####################################

FROM base
WORKDIR /app

# Install production dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy project artifacts
COPY --from=build /app/dist ./dist/

ENV NODE_ENV=production
CMD ["node", "--expose-gc", "--enable-source-maps", "dist/index.js"]
