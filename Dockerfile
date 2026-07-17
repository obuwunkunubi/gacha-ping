FROM oven/bun:1.3 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
# The runtime stage can't run mkdir/chown, so prepare /db here
RUN mkdir /db && chown 1000:1000 /db /app

# Distroless runtime: no shell or package manager, bun is the entrypoint
FROM oven/bun:1.3-distroless
WORKDIR /app
# The libsql native binding needs libgcc_s, which distroless doesn't ship.
# Path is amd64-specific; revisit if the image ever goes multi-arch.
COPY --from=build /lib/x86_64-linux-gnu/libgcc_s.so.1 /lib/x86_64-linux-gnu/
COPY --from=build --chown=1000:1000 /db /db
COPY --from=build --chown=1000:1000 /app/node_modules ./node_modules
COPY --chown=1000:1000 package.json ./
COPY --chown=1000:1000 src ./src
COPY --chown=1000:1000 drizzle ./drizzle
USER 1000
CMD ["run", "src/index.ts"]
