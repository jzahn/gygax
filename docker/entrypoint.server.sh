#!/bin/sh
set -e

echo "Generating Prisma client..."
npm run db:generate

echo "Running database migrations..."
npm run db:migrate:deploy

echo "Seeding database..."
npm run db:seed

echo "Starting server..."
exec "$@"
