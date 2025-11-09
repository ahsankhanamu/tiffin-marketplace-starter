# Scripts Directory

This directory contains utility scripts and shell scripts for the Tiffin Marketplace project.

## Structure

```
scripts/
├── db/              # Database-related scripts
├── utils/           # Utility scripts
├── setup/           # Setup and installation scripts
└── README.md        # This file
```

## Available Scripts

### Database Scripts (`db/`)

- **`init-db.sh`** - Initialize database (wrapper for `npm run db:init`)
- **`reset-db.sh`** - Completely reset database (removes all data)

### Utility Scripts (`utils/`)

- **`clean.sh`** - Clean build artifacts and node_modules
- **`check-deps.sh`** - Check if all required dependencies are installed

### Setup Scripts (`setup/`)

- **`setup-env.sh`** - Setup environment files from .env.example
- **`full-setup.sh`** - Complete project setup (deps, env, docker, db)

## Usage

All scripts can be run from the project root:

```bash
# Setup environment files
./scripts/setup/setup-env.sh

# Initialize database
./scripts/db/init-db.sh

# Full project setup
./scripts/setup/full-setup.sh

# Clean project
./scripts/utils/clean.sh

# Check dependencies
./scripts/utils/check-deps.sh
```

## NPM Scripts

These scripts are also available as npm scripts in `package.json`:

- `npm run setup:env` - Setup environment files
- `npm run db:init` - Initialize database
- `npm run clean` - Clean project
- `npm run setup:full` - Full project setup

