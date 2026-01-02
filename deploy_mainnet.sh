#!/bin/bash

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | xargs)
else
    echo "Error: .env file not found"
    exit 1
fi

if [ -z "$PRIVATE_KEY" ]; then
    echo "Error: PRIVATE_KEY not found in .env"
    exit 1
fi

echo "Deploying to Aleo Mainnet..."
echo "Program ID: private_messenger_mainnet_v1.aleo"

# Note: This requires 'snarkos' or 'leo' CLI installed and configured
# The private key provided in .env will be used.

# Using Leo CLI (if available)
if command -v leo &> /dev/null; then
    echo "Using Leo CLI..."
    leo deploy --network mainnet --private-key "$PRIVATE_KEY" --priority-fee 1000000
else
    echo "Leo CLI not found. Please install Leo or SnarkOS."
    echo "Command to run manually:"
    echo "leo deploy --network mainnet --private-key \$PRIVATE_KEY"
fi
