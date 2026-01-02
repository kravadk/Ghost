
async function checkEndpoints() {
    const endpoints = [
        "https://api.explorer.aleo.org/v1",
        "https://mainnet.aleorpc.com",
        "https://api.explorer.provable.com/v1"
    ];

    // Try just root or /testnet3/blocks/latest
    // Also try checking for program existence as a health check
    
    for (const url of endpoints) {
        console.log(`\nChecking ${url}...`);
        
        // Check 1: /testnet3/latest/height
        try {
            const res = await fetch(`${url}/testnet3/latest/height`);
            if (res.ok) console.log(`✅ /testnet3/latest/height: ${await res.text()}`);
            else console.log(`❌ /testnet3/latest/height: ${res.status}`);
        } catch(e) { console.log(`❌ /testnet3/latest/height failed: ${e.message}`); }

        // Check 2: /latest/height
        try {
            const res = await fetch(`${url}/latest/height`);
            if (res.ok) console.log(`✅ /latest/height: ${await res.text()}`);
            else console.log(`❌ /latest/height: ${res.status}`);
        } catch(e) { console.log(`❌ /latest/height failed: ${e.message}`); }
        
         // Check 3: /testnet3/program/credits.aleo
        try {
            const res = await fetch(`${url}/testnet3/program/credits.aleo`);
            if (res.ok) console.log(`✅ /testnet3/program/credits.aleo: Found`);
            else console.log(`❌ /testnet3/program/credits.aleo: ${res.status}`);
        } catch(e) { console.log(`❌ /testnet3/program/credits.aleo failed: ${e.message}`); }
    }
}

checkEndpoints();
