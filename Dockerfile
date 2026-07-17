FROM oven/bun:1.3 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
# The runtime stage can't run mkdir/cp/chown, so prepare everything here.
# libsql's native binding needs libgcc_s, which distroless doesn't ship;
# the glob resolves the multiarch dir (x86_64/aarch64) so the same
# Dockerfile builds on any platform.
RUN mkdir /db /app/native-libs \
  && cp /usr/lib/*/libgcc_s.so.1 /app/native-libs/ \
  && chown -R 1000:1000 /db /app

# Distroless runtime: no shell or package manager, bun is the entrypoint
FROM oven/bun:1.3-distroless
WORKDIR /app
ENV LD_LIBRARY_PATH=/app/native-libs
COPY --from=build --chown=1000:1000 /app/native-libs ./native-libs
COPY --from=build --chown=1000:1000 /db /db
COPY --from=build --chown=1000:1000 /app/node_modules ./node_modules
COPY --chown=1000:1000 package.json ./
COPY --chown=1000:1000 src ./src
COPY --chown=1000:1000 drizzle ./drizzle
USER 1000
CMD ["run", "src/index.ts"]
