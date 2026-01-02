
const PROGRAM_ID = "private_messenger_mainnet_v1.aleo";
const RPC_BASE = "https://mainnet.aleorpc.com";

async function checkProgram() {
    console.log(`Checking program ${PROGRAM_ID} on Mainnet...`);

    const paths = [
        `/testnet3/program/${PROGRAM_ID}`,
        `/program/${PROGRAM_ID}`,
        `/mainnet/program/${PROGRAM_ID}`
    ];

    for (const path of paths) {
        const url = `${RPC_BASE}${path}`;
        try {
            console.log(`Fetching ${url}...`);
            const res = await fetch(url);
            if (res.ok) {
                console.log(`✅ Program found at ${url}`);
                const text = await res.text();
                console.log("Program content preview:", text.substring(0, 100));
                return;
            } else {
                console.log(`❌ ${res.status} ${res.statusText}`);
            }
        } catch (e) {
            console.log(`Error fetching ${url}:`, e.message);
        }
    }
    
    console.log("⚠️ Program NOT found on any checked path.");
}

checkProgram();
