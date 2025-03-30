# Use the official Bun image as a base
FROM oven/bun:latest AS base

# Set the working directory
WORKDIR /app

# Copy the entire application
COPY . .

# Install dependencies
RUN bun install --frozen-lockfile

# Create the /db directory and set ownership for UID 1000
RUN mkdir -p /db && chown -R 1000:1000 /app /db

# Switch to the existing user with UID 1000
USER 1000

# Make the start.sh script executable
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]