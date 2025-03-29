# Use the official Bun image as a base
FROM oven/bun:latest AS base

# Set the working directory in the container
WORKDIR /app

# Copy package.json and bun.lock (if available)
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy the rest of the application
COPY . .

# Create a non-root user to run the application
RUN adduser --disabled-password --gecos "" appuser
# Create the /db directory and give permissions to appuser
RUN mkdir -p /db && chown -R appuser:appuser /app /db
USER appuser

# Create a smarter startup script that only runs migrations if needed
RUN echo '#!/bin/sh\n\
  # Check if database file exists\n\
  if [ ! -f "/db/gacha-ping.db" ]; then\n\
  echo "Database does not exist. Running migrations..."\n\
  bunx drizzle-kit push\n\
  else\n\
  echo "Database already exists. Skipping migrations."\n\
  fi\n\
  \n\
  # Start the application\n\
  exec bun run src/index.ts\n'\
  > /app/start.sh && chmod +x /app/start.sh

# Run the startup script
CMD ["/app/start.sh"]