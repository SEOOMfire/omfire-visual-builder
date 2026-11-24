#!/bin/sh
set -eu
node scripts/db-migrate.mjs
exec npm start
