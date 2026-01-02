import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import type { FC } from "react";
import { WalletProvider } from "@demox-labs/aleo-wallet-adapter-react";
import { LeoWalletAdapter } from "@demox-labs/aleo-wallet-adapter-leo";
import { PuzzleWalletAdapter } from "aleo-adapters";
import {
    DecryptPermission,
    WalletAdapterNetwork,
    Transaction,
} from "@demox-labs/aleo-wallet-adapter-base";
import { useWallet } from "@demox-labs/aleo-wallet-adapter-react";
import { AleoNetworkClient, ViewKey, RecordCiphertext, RecordPlaintext } from "@provablehq/sdk";
import "./App.css";

// Program ID
const PROGRAM_ID = "priv_mess_v4_1231.aleo";




type SentHistoryStatus = "Pending" | "Submitted" | "Success" | "Failed" | "Unknown";

type SentHistoryItem = {
    txId: string;
    type: string;
    timestamp: number;
    status: SentHistoryStatus;
    recipient?: string;
};

type InboxMessage = {
    id?: string;
    type: string;
    content: string;
    isDecrypted?: boolean;
    decryptedContent?: string;
    originalContent?: string;
    sender?: string;
    timestamp?: number;
    status?: string;
    cipherText?: string;
    txId?: string;
    transitionId?: string;
    tpk?: string;
    outputIndex?: number;
};

type WalletAdapterExtras = {
    transactionStatus?: (txId: string) => Promise<string>;
    requestTransaction?: (tx: Transaction) => Promise<string>;
    requestRecordPlaintexts?: (programId: string) => Promise<Array<{ id?: string; plaintext: string }>>;
    requestRecords?: (programId: string) => Promise<unknown[]>;
    requestTransactionHistory?: (programId: string) => Promise<unknown[]>;
    decrypt?: (cipherText: string, tpk?: string, programId?: string, functionName?: string, index?: number) => Promise<unknown>;
};

type Profile = {
    name: string;
    bio: string;
};

const getErrorMessage = (e: unknown) => {
    if (e instanceof Error) return e.message;
    if (typeof e === "string") return e;
    try {
        return JSON.stringify(e);
    } catch {
        return "Unknown error";
    }
};

interface NetworkProps {
    network: WalletAdapterNetwork;
}

export const WalletConnectButton: FC<NetworkProps> = ({ network }) => {
    const { publicKey, disconnect, connecting, select, wallets } = useWallet();
    const [showModal, setShowModal] = useState(false);

    if (publicKey) {
        return (
            <button onClick={disconnect}>
                Disconnect {publicKey.slice(0, 6)}...{publicKey.slice(-4)}
            </button>
        );
    }

    return (
        <>
            <button
                disabled={connecting}
                onClick={() => setShowModal(true)}
            >
                {connecting ? "Connecting..." : "Select Wallet"}
            </button>

            {showModal && (
                <div style={{
                    position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
                    background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000
                }}>
                    <div style={{ background: "white", padding: "20px", borderRadius: "8px", width: "300px", color: "black" }}>
                        <h3>Select Wallet</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {wallets.map((w) => (
                                <button
                                    key={w.adapter.name}
                                    onClick={async () => {
                                        try {
                                            // Fix: Connect directly via adapter to avoid WalletNotSelectedError
                                            // The 'connect' from useWallet relies on 'selected' state which updates async
                                            try {
                                                await w.adapter.connect(DecryptPermission.OnChainHistory, network, [PROGRAM_ID]);
                                                select(w.adapter.name);
                                                setShowModal(false);
                                            } catch (e: unknown) {
                                                console.error("Connection failed:", e);
                                                const msg = getErrorMessage(e);
                                                if (msg.includes("NETWORK_NOT_GRANTED")) {
                                                    alert(`Connection failed: Incorrect Network.\nPlease switch your Leo Wallet to '${network}' and try again.`);
                                                } else {
                                                    alert("Connection failed: " + msg);
                                                }
                                            }
                                        } catch (e: unknown) {
                                            // Redundant catch but safe
                                            console.error("Connection failed:", e);
                                            alert("Connection failed: " + getErrorMessage(e));
                                        }
                                    }}
                                    style={{ padding: "10px", cursor: "pointer", border: "1px solid #ddd", background: "#fff" }}
                                >
                                    {w.adapter.name}
                                </button>
                            ))}
                            <button onClick={() => setShowModal(false)} style={{ marginTop: "10px", background: "#eee" }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

const MessengerUI: FC<NetworkProps> = ({ network }) => {
    const { wallet, publicKey, transactionStatus, requestRecords } = useWallet();
    const adapter = wallet?.adapter as unknown as WalletAdapterExtras | undefined;
    const [status, setStatus] = useState("Idle");
    const [recipient, setRecipient] = useState("");
    const [viewKey, setViewKey] = useState(""); // For advanced sync
    const [viewKeyInput, setViewKeyInput] = useState(""); // Input state for view key
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [message, setMessage] = useState("");
    const [profileName, setProfileName] = useState("");
    const [profileBio, setProfileBio] = useState("");
    const [fetchedProfile, setFetchedProfile] = useState<Profile | null>(null);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [sentHistory, setSentHistory] = useState<SentHistoryItem[]>([]);
    const [profiles] = useState<Map<string, Profile>>(() => new Map());
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [importTxId, setImportTxId] = useState("");
    const retryMap = useRef<{ [key: string]: number }>({});
    const isSyncingRef = useRef(false);
    const lastChainScanAtRef = useRef(0);



    const fetchProfiles = async () => {
        try {
            // In a real app, we would fetch all profiles from the contract mapping
            // For now, we'll just try to fetch the current user's profile if they have one
            if (publicKey) {
                // This is a placeholder. To fully implement, we need a way to query 
                // the 'profiles' mapping from the contract for specific addresses.
                // Since we don't have a list of all users, we can't easily pre-fetch everyone.
                // However, we can implement a lazy lookup in the future.

                // For this demo, we'll just ensure the state is initialized
                console.log("Profiles state initialized");
            }
        } catch (e) {
            console.warn("Failed to fetch profiles:", e);
        }
    };

    // Check Pending Transactions
    useEffect(() => {
        const checkPending = async () => {
            if (!publicKey) return;

            let updated = false;
            const newHistory = await Promise.all(sentHistory.map(async (item) => {
                if (item.status === "Pending" || item.status === "Submitted") {
                    let statusChanged = false;
                    const newItem = { ...item };

                    // Increment retry count for this tx
                    retryMap.current[item.txId] = (retryMap.current[item.txId] || 0) + 1;
                    const failCount = retryMap.current[item.txId] || 0;
                    if (failCount > 20) { // Stop after ~100 seconds of failures
                        newItem.status = "Unknown";
                        statusChanged = true;
                    }

                    // Check wallet status first
                    if (adapter && adapter.transactionStatus) {
                        try {
                            const s = await adapter.transactionStatus(item.txId);
                            if (s === "Completed" || s === "Finalized") {
                                newItem.status = "Success";
                                statusChanged = true;
                                console.log("Transaction mined.");
                            } else if (s === "Failed" || s === "Rejected") {
                                newItem.status = "Failed";
                                statusChanged = true;
                            }
                        } catch {
                            void 0;
                        }
                    }

                    if (statusChanged) {
                        updated = true;
                        return newItem;
                    }
                }
                return item;
            }));

            if (updated) {
                setSentHistory(newHistory);
            }
        };

        // Run immediately and then every 5 seconds
        if (sentHistory.some(i => i.status === "Pending" || i.status === "Submitted")) {
            checkPending();
            const interval = setInterval(checkPending, 5000);
            return () => clearInterval(interval);
        }
    }, [sentHistory, transactionStatus, publicKey, adapter]);

    useEffect(() => {
        localStorage.setItem("sentHistory", JSON.stringify(sentHistory));
    }, [sentHistory]);

    const addToHistory = (txId: string, type: string, recipient?: string) => {
        const newItem: SentHistoryItem = { txId, type, timestamp: Date.now(), status: "Pending", recipient };
        setSentHistory(prev => [newItem, ...prev]);
    };

    // Inbox State
    const [messages, setMessages] = useState<InboxMessage[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);

    // --- Effects (Moved here to avoid ReferenceError) ---

    // Load/Save Sent History and Inbox Messages based on PublicKey
    useEffect(() => {
        if (!publicKey) {
            // Clear state on disconnect
            setSentHistory([]);
            setMessages([]);
            return;
        }

        // Load Sent History
        const savedHistory = localStorage.getItem(`sentHistory_${publicKey}`);
        if (savedHistory) {
            try {
                setSentHistory(JSON.parse(savedHistory) as SentHistoryItem[]);
            } catch {
                console.warn("Failed to parse saved history");
            }
        } else {
            setSentHistory([]);
        }

        // Load Inbox Messages
        const savedMessages = localStorage.getItem(`inboxMessages_${publicKey}`);
        if (savedMessages) {
            try {
                const parsed = JSON.parse(savedMessages);
                setMessages(parsed);
            } catch {
                console.warn("Failed to parse saved messages");
            }
        } else {
            setMessages([]);
        }

        // Fetch profiles on load
        fetchProfiles();
    }, [publicKey]);

    // Save Sent History whenever it changes
    useEffect(() => {
        if (publicKey && sentHistory.length > 0) {
            localStorage.setItem(`sentHistory_${publicKey}`, JSON.stringify(sentHistory));
        }
    }, [sentHistory, publicKey]);

    // Save Inbox Messages whenever they change
    useEffect(() => {
        if (publicKey && messages.length > 0) {
            localStorage.setItem(`inboxMessages_${publicKey}`, JSON.stringify(messages));
        }
    }, [messages, publicKey]);


    useEffect(() => {
        if (publicKey) {
            const savedMessages = localStorage.getItem(`inbox_${publicKey}`);
            if (savedMessages) {
                try {
                    const parsed = JSON.parse(savedMessages) as InboxMessage[];
                    setMessages(parsed);
                } catch {
                    void 0;
                }
            }
        }
    }, [publicKey]);

    useEffect(() => {
        if (publicKey && messages.length > 0) {
            localStorage.setItem(`inbox_${publicKey}`, JSON.stringify(messages));
        }
    }, [messages, publicKey]);


    useEffect(() => {
        if (publicKey) {
            const savedProfile = localStorage.getItem(`profile_${publicKey}`);
            if (savedProfile) {
                try {
                    setFetchedProfile(JSON.parse(savedProfile) as Profile);
                } catch {
                    void 0;
                }
            }
        }
    }, [publicKey]);

    // --- Helper Functions ---

    // New robust parser for Aleo records
    const parseMessageContent = (raw: string): string => {
        if (!raw) return "";

        // 1. If it doesn't look like a record, assume it might be a direct field or plain text
        if (!raw.includes("owner:") && !raw.includes("content:")) {
            // Check if it's a field value directly (e.g. "56field")
            if (raw.match(/^\d+field(?:\.(?:private|public))?$/)) {
                return fieldToString(raw);
            }
            // Return as is (could be already decoded)
            return raw;
        }

        // 2. Extract content value
        if (!raw) return ""; // Guard against null/undefined
        const cleanStr = String(raw).replace(/\s+/g, " ");
        // Match "content:" followed by value, ending at comma or closing brace
        // We capture everything until the next separator
        const match = cleanStr.match(/content:\s*([^,}\s]+)/);

        if (match && match[1]) {
            // 3. Decode the extracted field
            return fieldToString(match[1]);
        }

        return raw; // Fallback
    };

    const stringToField = (str: string) => {
        try {
            if (!str) return "0field";
            const encoder = new TextEncoder();
            const encoded = encoder.encode(str);
            let val = BigInt(0);
            for (let i = 0; i < Math.min(encoded.length, 31); i++) {
                val = (val << BigInt(8)) | BigInt(encoded[i]);
            }
            return val.toString() + "field";
        } catch (e) {
            console.error("Error encoding string to field:", e);
            return "0field";
        }
    };

    const fieldToString = (fieldStr: string) => {
        try {
            // Remove known suffixes first (global replace)
            let valStr = fieldStr.replace(/field/g, "")
                .replace(/u64/g, "")
                .replace(/\.private/g, "")
                .replace(/\.public/g, "");

            // Remove any non-digit characters to be safe (e.g. spaces, commas, quotes)
            valStr = valStr.replace(/\D/g, "");

            if (!valStr) return fieldStr;

            let val = BigInt(valStr);
            const originalValStr = valStr;

            const bytes = [];
            while (val > 0n) {
                bytes.unshift(Number(val & 0xffn));
                val >>= 8n;
            }

            if (bytes.length === 0) return "";

            const decoder = new TextDecoder();
            const decoded = decoder.decode(new Uint8Array(bytes));

            if (decoded.length === 0) return originalValStr;

            // Printable check
            let isPrintable = true;
            for (let i = 0; i < decoded.length; i++) {
                if (decoded.charCodeAt(i) < 32) {
                    isPrintable = false;
                    break;
                }
            }

            if (!isPrintable) {
                return originalValStr;
            }

            return decoded;
        } catch {
            return fieldStr;
        }
    };



    // --- Actions ---

    const handleCreateProfile = async () => {
        if (!publicKey) return alert("Connect wallet first");
        if (!adapter?.requestTransaction) return alert("Please connect your wallet first.");

        const encoder = new TextEncoder();
        if (encoder.encode(profileName).length > 31) {
            return alert(`Name too long! Max 31 bytes (current: ${encoder.encode(profileName).length})`);
        }

        localStorage.setItem(`profile_${publicKey}`, JSON.stringify({ name: profileName, bio: profileBio }));
        setFetchedProfile({ name: profileName, bio: profileBio });

        setStatus("Creating Profile... Signing Transaction...");
        try {
            const nameField = stringToField(profileName);
            const bioField = stringToField(profileBio);

            const transaction = Transaction.createTransaction(
                publicKey,
                network,
                PROGRAM_ID,
                "update_profile",
                [nameField, bioField],
                4000000,
                false // public fee
            );

            const txId = await adapter.requestTransaction(transaction);

            if (txId) {
                addToHistory(txId, "Update Profile");
                setStatus("Profile update transaction sent! ID: " + txId);
            }
        } catch (e: unknown) {
            console.error("Profile update error", e);
            setStatus("Error: " + getErrorMessage(e));
        }
    };

    const sendMessage = async () => {
        if (!recipient || !message) return alert("Fill fields");
        if (!publicKey) return alert("Connect wallet");
        if (!adapter?.requestTransaction) return alert("Please connect your wallet first.");

        try {
            setStatus("Sending message...");
            const contentField = stringToField(message);

            const transaction = Transaction.createTransaction(
                publicKey,
                network,
                PROGRAM_ID,
                "send_message",
                [recipient, contentField],
                4000000,
                false
            );

            const txId = await adapter.requestTransaction(transaction);

            if (txId) {
                addToHistory(txId, "Send Message", recipient);
                setStatus("Message sent! ID: " + txId);
                setMessage("");
            }
        } catch (e: unknown) {
            const msg = getErrorMessage(e);
            if (msg.includes("Permission") || msg.includes("NOT_GRANTED")) {
                setStatus("Transaction rejected by user.");
            } else {
                console.error("Send message error:", e);
                setStatus("Error sending: " + msg);
            }
        }
    };

    // Helper to sanitize record string
    const sanitizeRecordString = (str: string) => {
        if (!str) return "";
        // 1. Remove ALL whitespace (including internal spaces, newlines)
        let cleaned = str.replace(/\s/g, "");
        
        // 2. Remove invisible control characters
        cleaned = cleaned.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
        
        // 3. Remove surrounding quotes (recursively)
        while (cleaned.startsWith('"') && cleaned.endsWith('"')) {
            cleaned = cleaned.slice(1, -1);
        }

        // 4. Unescape escaped quotes (though strictly Bech32 shouldn't have them)
        cleaned = cleaned.replace(/\\"/g, '"');
        
        // 5. Final check: if it still contains quotes, remove them? 
        // Bech32 charset is alphanumeric. Quotes are invalid.
        cleaned = cleaned.replace(/["']/g, "");

        return cleaned;
    };

    type DecryptedRecord = {
        content: string;
        sender?: string;
        recipient?: string;
        fullPlaintext?: string;
    };

    const decryptRecord = async (
        ciphertext: string,
        ctx: { tpk?: string; programId: string; functionName: string; indexes: number[] }
    ): Promise<DecryptedRecord | null> => {
        if (!ciphertext) return null;
        const cleanCiphertext = sanitizeRecordString(ciphertext);
        
        let fullPlaintext = "";
        let content = "";
        let sender: string | undefined;
        let recipient: string | undefined;

        // 1. Try View Key (Priority)
        if (viewKey && viewKey.startsWith("AViewKey1")) {
            try {
                const vk = ViewKey.from_string(viewKey);
                let decryptedStr: string | null = null;
                let isEncryptedRecord = cleanCiphertext.startsWith("record1");

                if (isEncryptedRecord) {
                    try {
                        const rc = RecordCiphertext.fromString(cleanCiphertext);
                        if (rc.isOwner(vk)) {
                            decryptedStr = rc.decrypt(vk).toString();
                        }
                    } catch (e) { 
                        // console.warn("RecordCiphertext decrypt failed:", e);
                    }
                }

                if (!decryptedStr) {
                    try {
                         // @ts-ignore
                         const direct = vk.decrypt(cleanCiphertext);
                         if (direct) decryptedStr = direct.toString();
                    } catch (e) { }
                }

                if (!decryptedStr && !isEncryptedRecord) {
                    try {
                         const rp = RecordPlaintext.fromString(cleanCiphertext);
                         decryptedStr = rp.toString();
                    } catch (e) { }
                }

                if (decryptedStr) {
                    fullPlaintext = decryptedStr;
                }
            } catch (e) { console.warn("ViewKey decrypt error", e); }
        }

        // 2. Try Wallet Adapter
        if (!fullPlaintext && adapter?.decrypt) {
             const normalizeTpk = (tpk: string | undefined) => {
                if (!tpk) return [];
                const trimmed = tpk.trim();
                const withoutSuffix = trimmed.endsWith("group") ? trimmed.slice(0, -5) : trimmed;
                return Array.from(new Set([trimmed, withoutSuffix].filter(Boolean)));
            };

            const tryDecryptFn = async (args: any[]) => {
                try {
                     // @ts-ignore
                     return await adapter.decrypt(...args);
                } catch (e) { return null; }
            };

            const indexes = Array.from(new Set(ctx.indexes)).filter((n) => Number.isInteger(n) && n >= 0);
            const tpks = normalizeTpk(ctx.tpk);

            const attempts: any[][] = [
                [cleanCiphertext, undefined, undefined, undefined, undefined],
                [cleanCiphertext, undefined, ctx.programId, ctx.functionName, undefined],
                [cleanCiphertext, undefined, ctx.programId, ctx.functionName, 0],
                [cleanCiphertext, undefined, ctx.programId, ctx.functionName, 1],
            ];

            for (const tpk of tpks) {
                attempts.push([cleanCiphertext, tpk, undefined, undefined, undefined]);
                attempts.push([cleanCiphertext, tpk, ctx.programId, ctx.functionName, undefined]);
            }

            for (const tpk of tpks) {
                for (const index of indexes.length > 0 ? indexes : [0, 1]) {
                    attempts.push([cleanCiphertext, tpk, ctx.programId, ctx.functionName, index]);
                }
            }

            for (let i = 0; i < Math.min(attempts.length, 20); i++) {
                const res = await tryDecryptFn(attempts[i]);
                if (res) {
                    if (typeof res === 'string') {
                        fullPlaintext = res;
                    } else if (typeof res === 'object') {
                        // Handle object result
                        const obj = res as any;
                        if (obj.plaintext) fullPlaintext = obj.plaintext;
                        else if (obj.text) fullPlaintext = obj.text;
                        else if (obj.content) fullPlaintext = obj.content; // fallback
                        
                        // Extract fields directly from object if available
                        if (obj.sender) sender = obj.sender;
                        if (obj.recipient) recipient = obj.recipient;
                        if (obj.content) content = fieldToString(obj.content);
                    }
                    break;
                }
            }
        }

        if (fullPlaintext) {
             // Parse fields from string if not already found
             if (!content) {
                 const match = fullPlaintext.match(/content:\s*([^\s,.}]+)/);
                 if (match && match[1]) content = fieldToString(match[1]);
                 else content = fullPlaintext; // fallback
             }
             if (!sender) {
                 const match = fullPlaintext.match(/sender:\s*([^\s,.}]+)/);
                 if (match && match[1]) sender = match[1];
             }
             if (!recipient) {
                 const match = fullPlaintext.match(/recipient:\s*([^\s,.}]+)/);
                 if (match && match[1]) recipient = match[1];
             }
             
             return { content, sender, recipient, fullPlaintext };
        }
        
        return null;
    };

    const decryptCiphertextToText = async (
        ciphertext: string,
        ctx: { tpk?: string; programId: string; functionName: string; indexes: number[] }
    ): Promise<string | null> => {
        const res = await decryptRecord(ciphertext, ctx);
        return res ? res.content : null;
    };

    const getProvableApiBase = (net: WalletAdapterNetwork) => {
        const origin =
            (import.meta.env.VITE_PROVABLE_API_ORIGIN as string | undefined) ||
            (import.meta.env.DEV ? "/provable" : "https://api.explorer.provable.com");
        const networkPath = net === WalletAdapterNetwork.MainnetBeta ? "mainnet" : "testnet";
        return `${origin.replace(/\/$/, "")}/v1/${networkPath}`;
    };

    const fetchRecordsFromWalletAPI = async (forceRefresh: boolean = false) => {
        try {
            console.log(`Fetching records from wallet API (force=${forceRefresh})...`);
            
            // Leo Wallet specific: requestRecordPlaintexts sometimes fails with INVALID_PARAMS 
            // if OnChainHistory is not enabled or for other reasons.
            // We'll wrap it and fallback if needed.

            if (adapter?.requestRecordPlaintexts) {
                try {
                     const records = await adapter.requestRecordPlaintexts(PROGRAM_ID);
                     console.log(`✅ Fetched ${records?.length || 0} records from wallet`);
                     return records || [];
                } catch (e: any) {
                    console.warn("adapter.requestRecordPlaintexts failed:", e);
                    // If it's INVALID_PARAMS, we might want to skip to other methods or return empty to trigger fallback
                }
            }

            const rr = requestRecords || adapter?.requestRecords;
            if (rr) {
                // ... existing requestRecords logic ...
                const records = await rr(PROGRAM_ID);
                console.log(`✅ Fetched ${records?.length || 0} records from wallet`);

                if (records && records.length > 0 && adapter?.decrypt) {
                    const decryptedRecords: Array<{ id?: string; plaintext: string }> = [];
                    for (const record of records) {
                        try {
                            if (typeof record === "string") {
                                if (record.startsWith("record1")) {
                                    const decrypted = await adapter.decrypt(record);
                                    if (typeof decrypted === "string") {
                                        decryptedRecords.push({ plaintext: decrypted });
                                    } else {
                                        decryptedRecords.push({ plaintext: JSON.stringify(decrypted) });
                                    }
                                } else {
                                    decryptedRecords.push({ plaintext: record });
                                }
                            } else if (record && typeof record === "object") {
                                const obj = record as Record<string, unknown>;
                                const ciphertext =
                                    (typeof obj.ciphertext === "string" && obj.ciphertext) ||
                                    (typeof obj.record === "string" && obj.record) ||
                                    "";
                                if (ciphertext && ciphertext.startsWith("record1")) {
                                    const decrypted = await adapter.decrypt(ciphertext);
                                    decryptedRecords.push({
                                        id: typeof obj.id === "string" ? obj.id : undefined,
                                        plaintext: typeof decrypted === "string" ? decrypted : JSON.stringify(decrypted),
                                    });
                                }
                            }
                        } catch (decryptErr) {
                            console.warn("Failed to decrypt record:", decryptErr);
                        }
                    }
                    return decryptedRecords;
                }

                return records || [];
            }

            console.warn("Wallet record requests are not available");
            return [];
        } catch (e: unknown) {
            console.error("Wallet API fetch failed:", e);
            return [];
        }
    };

    const fetchTransactionIdsFromWallet = async (): Promise<string[]> => {
        if (!adapter?.requestTransactionHistory) return [];
        try {
            const txs = await adapter.requestTransactionHistory(PROGRAM_ID);
            const ids: string[] = [];
            for (const t of txs || []) {
                if (typeof t === "string") {
                    if (/^at[0-9a-z]+$/i.test(t)) ids.push(t);
                } else if (t && typeof t === "object") {
                    const obj = t as Record<string, unknown>;
                    const id =
                        (typeof obj.id === "string" && obj.id) ||
                        (typeof obj.transactionId === "string" && obj.transactionId) ||
                        (typeof obj.transaction_id === "string" && obj.transaction_id) ||
                        "";
                    if (id && /^at[0-9a-z]+$/i.test(id)) ids.push(id);
                }
            }
            return ids;
        } catch (e: unknown) {
            const msg = getErrorMessage(e);
            if (msg.includes("Method not implemented") || msg.includes("INVALID_PARAMS")) {
                 // Ignore this error as some adapters don't support history or params issue
                 console.log("⚠️ Wallet transaction history not available (Method not implemented or Invalid Params). Using block scan fallback.");
                 return [];
            }
            console.warn("Failed to fetch tx history from wallet:", e);
            return [];
        }
    };

    const fetchProvableTransaction = async (txId: string): Promise<unknown | null> => {
        const base = getProvableApiBase(network);
        const url = `${base}/transaction/${txId}`;

        const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
        for (let attempt = 0; attempt < 6; attempt++) {
            try {
                const res = await fetch(url);
                if (res.status === 429 || res.status >= 500) {
                    await delay(800 + attempt * 1000);
                    continue;
                }
                if (!res.ok) return null;
                return (await res.json()) as unknown;
            } catch {
                await delay(800 + attempt * 1000);
            }
        }
        return null;
    };

    const addMessagesFromTxId = async (txId: string, target: Map<string, InboxMessage>): Promise<"added" | "not_found" | "no_access"> => {
        if (!publicKey) return "no_access";

        const tx = await fetchProvableTransaction(txId);
        if (!tx || typeof tx !== "object") return "not_found";

        const txObj = tx as Record<string, unknown>;
        const execution = txObj.execution;
        if (!execution || typeof execution !== "object") return "not_found";

        const transitionsRaw = (execution as Record<string, unknown>).transitions;
        if (!Array.isArray(transitionsRaw)) return "not_found";

        let addedAny = false;

        for (const transition of transitionsRaw) {
            if (!transition || typeof transition !== "object") continue;
            const transitionObj = transition as Record<string, unknown>;
            if (transitionObj.program !== PROGRAM_ID) continue;
            if (transitionObj.function !== "send_message") continue;
            const tpk = typeof transitionObj.tpk === "string" ? transitionObj.tpk : undefined;
            const transitionId = typeof transitionObj.id === "string" ? transitionObj.id : undefined;

            const inputsRaw = transitionObj.inputs;
            const inputs = Array.isArray(inputsRaw) ? inputsRaw : [];
            const recipientAddr =
                (inputs[0] && typeof inputs[0] === "object" && (inputs[0] as Record<string, unknown>).type === "public")
                    ? String((inputs[0] as Record<string, unknown>).value || "")
                    : "";

            if (!recipientAddr || recipientAddr !== publicKey) continue;

            const outputsRaw = transitionObj.outputs;
            const outputs = Array.isArray(outputsRaw) ? outputsRaw : [];

            for (let idx = 0; idx < outputs.length; idx++) {
                const output = outputs[idx];
                if (!output || typeof output !== "object") continue;
                const outputObj = output as Record<string, unknown>;
                if (outputObj.type !== "record") continue;

                const recordId = typeof outputObj.id === "string" ? outputObj.id : undefined;
                const ciphertext = typeof outputObj.value === "string" ? outputObj.value : "";
                if (!ciphertext.startsWith("record1")) continue;

                let decrypted: DecryptedRecord | null = null;
                try {
                     decrypted = await decryptRecord(ciphertext, {
                        tpk,
                        programId: PROGRAM_ID,
                        functionName: "send_message",
                        indexes: [idx]
                     });
                } catch (e) { console.warn("Decrypt in addMessagesFromTxId failed", e); }

                const id = recordId || `${txId}:${transitionId || "transition"}:${idx}`;
                
                let messageType = "received";
                if (decrypted) {
                     if (decrypted.sender === publicKey) messageType = "sent";
                     // if (decrypted.recipient === publicKey) messageType = "received"; 
                }

                target.set(id, {
                    id,
                    type: messageType,
                    content: decrypted ? decrypted.content : ciphertext,
                    cipherText: ciphertext,
                    isDecrypted: !!decrypted,
                    sender: decrypted?.sender || "Unknown",
                    timestamp: Date.now(),
                    status: decrypted ? "Decrypted" : "Encrypted",
                    txId,
                    transitionId,
                    tpk,
                    outputIndex: idx,
                });
                addedAny = true;

                break;
            }
        }

        return addedAny ? "added" : "not_found";
    };

    // ========== getInboxMessages ==========
    const getInboxMessages = useCallback(async (force: boolean = false) => {
        if (!publicKey) {
            if (force) alert("Please connect your wallet.");
            return;
        }

        if (isSyncingRef.current) {
            console.log("⏭️  Sync already in progress, skipping...");
            return;
        }

        setIsSyncing(true);
        isSyncingRef.current = true;

        try {
            console.log(`🔄 Starting inbox sync (force=${force})...`);
            setStatus("Syncing...");

            const allMessagesMap = new Map<string, InboxMessage>();

            // 2. Standard Sync (Wallet API) - Default Priority
            // We always try to fetch from the wallet first, as requested.
            setStatus("Fetching from Wallet API...");
            try {
                const walletRecords = await fetchRecordsFromWalletAPI(force);

                if (walletRecords && walletRecords.length > 0) {
                    console.log(`📦 Got ${walletRecords.length} records from wallet`);

                    walletRecords.forEach((r: unknown) => {
                        let plaintext = "";
                        let id = "wallet-" + Math.random().toString(36).substr(2, 9);

                        // Extract plaintext from record
                        if (typeof r === "string") {
                            plaintext = r;
                        } else if (typeof r === "object" && r !== null) {
                            const obj = r as Record<string, unknown>;
                            if (typeof obj.plaintext === "string") plaintext = obj.plaintext;
                            else if (typeof obj.content === "string") plaintext = obj.content;
                            if (typeof obj.id === "string") id = obj.id;
                        }

                        if (!plaintext) {
                            console.warn("⚠️  Empty record, skipping");
                            return;
                        }

                        const nonceMatch = plaintext.match(/_nonce:\s*([a-zA-Z0-9]+)/);
                        if (nonceMatch && nonceMatch[1]) {
                            id = nonceMatch[1];
                        }

                        const parsedContent = parseMessageContent(plaintext);

                        const ownerMatch = plaintext.match(/owner:\s*([a-zA-Z0-9]+)/);
                        const senderMatch = plaintext.match(/sender:\s*([a-zA-Z0-9]+)/);
                        const recipientMatch = plaintext.match(/recipient:\s*([a-zA-Z0-9]+)/);

                        const owner = ownerMatch?.[1];
                        const sender = senderMatch?.[1];
                        const recipientAddr = recipientMatch?.[1];

                        if (!sender || !recipientAddr) return;

                        const messageType =
                            owner === publicKey && recipientAddr !== publicKey ? "sent" : "received";

                        const counterparty = messageType === "sent" ? recipientAddr : sender;

                        let displayName = counterparty;
                        if (profiles.has(counterparty)) {
                            displayName = profiles.get(counterparty)?.name || counterparty;
                        }
                        if (displayName === counterparty && counterparty.length > 20) {
                            displayName = counterparty.slice(0, 6) + "..." + counterparty.slice(-6);
                        }

                        // Use ID as key to allow duplicate content
                        const key = id || parsedContent + displayName;

                        // Add to map
                        allMessagesMap.set(key, {
                            id: id,
                            type: messageType,
                            content: parsedContent,
                            isDecrypted: true,
                            decryptedContent: parsedContent,
                            originalContent: plaintext,
                            sender: displayName,
                            timestamp: Date.now(),
                            status: "Decrypted"
                        });
                    });
                } else {
                    console.log("📭 No records from wallet API");
                }
            } catch (walletError) {
                console.error("❌ Wallet API failed:", walletError);
            }

            if (allMessagesMap.size === 0 || force) {
                const txIds = await fetchTransactionIdsFromWallet();
                if (txIds.length > 0) {
                    const seenKey = `seen_txs_${publicKey}`;
                    const seenRaw = localStorage.getItem(seenKey);
                    let seen = new Set<string>();
                    if (seenRaw) {
                        try {
                            const parsed = JSON.parse(seenRaw) as string[];
                            seen = new Set(parsed);
                        } catch {
                            void 0;
                        }
                    }

                    // Check more transactions if forcing sync
                    const limit = force ? 100 : 50;
                    const toCheck = txIds.slice(-limit).filter((id) => force || !seen.has(id));
                    
                    if (toCheck.length > 0) {
                        console.log(`Checking ${toCheck.length} transactions from history...`);
                        setStatus(`Checking ${toCheck.length} wallet transactions...`);
                    }

                    let checkedCount = 0;
                    for (const txId of toCheck) {
                        if (!isSyncingRef.current) break;
                        checkedCount++;
                        if (checkedCount % 5 === 0) setStatus(`Checking transaction ${checkedCount}/${toCheck.length}...`);
                        
                        const result = await addMessagesFromTxId(txId, allMessagesMap);
                        if (result === "added") {
                            seen.add(txId);
                        }
                        // Reduced delay for transactions as we are fetching specific IDs
                        await new Promise<void>((resolve) => setTimeout(resolve, 200));
                    }

                    if (toCheck.length > 0) {
                        // Keep last 1000 seen txs
                        localStorage.setItem(seenKey, JSON.stringify(Array.from(seen).slice(-1000)));
                    }
                }
            }

            // Only chain scan if explicitly forced AND we really need to.
            // But usually transaction history is enough. 
            // We limit scan depth drastically to avoid "forever" loops.
            const shouldChainScan = force;

            if (shouldChainScan) {
                lastChainScanAtRef.current = Date.now();
                try {
                    setStatus("Scanning chain (recent blocks)...");

                    const base = getProvableApiBase(network);

                    const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

                        const fetchTextWithRetry = async (url: string): Promise<string> => {
                            let lastStatus = 0;
                            for (let attempt = 0; attempt < 5; attempt++) {
                                try {
                                    const res = await fetch(url);
                                    lastStatus = res.status;
                                    if (res.status === 429 || res.status >= 500) {
                                        await delay(800 + attempt * 800);
                                        continue;
                                    }
                                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                                    return await res.text();
                                } catch {
                                    await delay(800 + attempt * 800);
                                    continue;
                                }
                            }
                            throw new Error(`Rate limited (${lastStatus})`);
                        };

                        const fetchJsonWithRetry = async (url: string): Promise<unknown> => {
                            let lastStatus = 0;
                            for (let attempt = 0; attempt < 5; attempt++) {
                                try {
                                    const res = await fetch(url);
                                    lastStatus = res.status;
                                    if (res.status === 429 || res.status >= 500) {
                                        await delay(800 + attempt * 800);
                                        continue;
                                    }
                                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                                    return (await res.json()) as unknown;
                                } catch {
                                    await delay(800 + attempt * 800);
                                    continue;
                                }
                            }
                            throw new Error(`Rate limited (${lastStatus})`);
                        };

                    const heightText = await fetchTextWithRetry(`${base}/latest/height`);
                    const height = Number.parseInt(heightText, 10);
                    if (Number.isFinite(height) && height > 0) {
                        const lastSyncKey = `last_sync_height_${network}_${publicKey}`;
                        const lastSyncHeightStr = localStorage.getItem(lastSyncKey);
                        const lastSyncHeight = lastSyncHeightStr ? Number.parseInt(lastSyncHeightStr, 10) : null;

                        const scanDepth = 100; // Increased to 100 to cover more recent history
                        const start = Number.isFinite(lastSyncHeight as number)
                            ? Math.max(0, (lastSyncHeight as number) - 2)
                            : Math.max(0, height - scanDepth);
                        const end = height + 1;
                        
                        // Limit the max number of blocks to scan in one go to 50
                        // even if lastSyncHeight is old.
                        const actualStart = Math.max(start, end - 50);

                        // If ViewKey is provided, use SDK findRecords (Deep Sync)
                        if (viewKey && viewKey.startsWith("AViewKey1")) {
                            setStatus("Deep Syncing with ViewKey...");
                            console.log("Starting Deep Sync via SDK...");
                            // Note: We would need an Account object or similar to use findRecords properly with decryption.
                            // But AleoNetworkClient.findRecords returns Encrypted Records if we don't provide a key?
                            // Actually, findRecords logic is complex.
                            // For this MVP, we will just use the View Key to DECRYPT the manually fetched records if needed,
                            // OR if we can use the SDK.
                            // However, let's stick to the "Block Scan" but using networkClient.getBlock() for reliability.
                        }

                        // Fallback: Smart Block Scan (Manual)
                        // Fetch blocks one by one to avoid 429
                        for (let h = actualStart; h < end; h++) {
                            if (!isSyncingRef.current) break;
                            setStatus(`Scanning block ${h} / ${end - 1}...`);
                            
                            try {
                                // Manual fetch to control URL (AleoNetworkClient might use deprecated testnet3)
                                const blockUrl = `${base}/block/${h}`;
                                const block = await fetchJsonWithRetry(blockUrl) as any;
                                
                                if (!block) continue;

                                const txs = block.transactions || [];
                                for (const tx of txs) {
                                    // Check if transaction interacts with our program
                                    // SDK object structure might differ slightly from raw JSON
                                    // We need to be careful with types.
                                    // Let's assume standard structure or cast to any
                                    const txAny = tx as any;
                                    
                                    // Optimization: Check if program is mentioned in transaction (if possible)
                                    // or just iterate transitions
                                    if (!txAny.execution || !txAny.execution.transitions) continue;

                                    for (const transition of txAny.execution.transitions) {
                                        if (transition.program !== PROGRAM_ID) continue;
                                        if (transition.function !== "send_message") continue;

                                        // Found a relevant transition!
                                        // Process outputs
                                        const outputs = transition.outputs || [];
                                        for (let idx = 0; idx < outputs.length; idx++) {
                                            const output = outputs[idx];
                                            if (output.type !== "record") continue;
                                            const ciphertext = output.value; // In SDK, it might be 'value'

                                            if (typeof ciphertext === 'string' && ciphertext.startsWith("record1")) {
                                                // Try to decrypt!
                                                let decrypted: DecryptedRecord | null = null;
                                                try {
                                                    decrypted = await decryptRecord(ciphertext, {
                                                        tpk: transition.tpk,
                                                        programId: PROGRAM_ID,
                                                        functionName: "send_message",
                                                        indexes: [idx]
                                                    });
                                                } catch (e) { console.warn("Decrypt in scanBlocks failed", e); }

                                                const id = `${txAny.id}:${transition.id}:${idx}`;
                                                
                                                let messageType = "received";
                                                if (decrypted) {
                                                     if (decrypted.sender === publicKey) messageType = "sent";
                                                }

                                                allMessagesMap.set(id, {
                                                    id,
                                                    type: messageType,
                                                    content: decrypted ? decrypted.content : ciphertext,
                                                    cipherText: ciphertext,
                                                    isDecrypted: !!decrypted,
                                                    sender: decrypted?.sender || "Unknown",
                                                    timestamp: Date.now(),
                                                    status: decrypted ? "Decrypted" : "Encrypted",
                                                    txId: txAny.id
                                                });
                                            }
                                        }
                                    }
                                }
                            } catch (e) {
                                console.warn(`Failed to scan block ${h}`, e);
                            }

                            // Gentle delay to prevent 429 (reduced from 1000ms as we scan fewer blocks)
                            await delay(200); 
                        }

                        localStorage.setItem(lastSyncKey, String(height));
                    }
                } catch (e) {
                    console.warn("Chain scan failed:", e);
                }
            }

            // 3. Update State
            if (allMessagesMap.size > 0) {
                setMessages(prev => {
                    // Merge with existing messages
                    const merged = new Map<string, InboxMessage>();

                    // Add existing messages
                    prev.forEach(m => {
                        // Use ID if available, otherwise content (legacy)
                        const key = m.id || m.content + (m.sender || "");
                        merged.set(key, m);
                    });

                    // Add new messages (will update existing if same key)
                    allMessagesMap.forEach((m, key) => {
                        merged.set(key, m);
                    });

                    return Array.from(merged.values());
                });
                setStatus(`Sync Complete! ${allMessagesMap.size} messages.`);
                console.log(`✅ Inbox updated with ${allMessagesMap.size} messages`);
            } else {
                setStatus("Sync Complete. No new messages.");
            }

            setLastSyncTime(new Date());

        } catch (error) {
            console.error("❌ Sync failed:", error);
            setStatus("Sync failed. See console.");
        } finally {
            setIsSyncing(false);
            isSyncingRef.current = false;
        }
    }, [publicKey, network, profiles]);

    const handleImportTx = async () => {
        const txId = importTxId.trim();
        if (!publicKey) return alert("Connect wallet first");
        if (!/^at[0-9a-z]+$/i.test(txId)) return alert("Invalid tx id (expected at...)");

        setStatus("Importing transaction...");
        const map = new Map<string, InboxMessage>();
        const result = await addMessagesFromTxId(txId, map);

        if (result === "no_access") {
            setStatus("Wallet decrypt is not available.");
            return;
        }

        if (result !== "added" || map.size === 0) {
            setStatus("No messages found for this account in this tx.");
            return;
        }

        setMessages((prev) => {
            const merged = new Map<string, InboxMessage>();
            prev.forEach((m) => merged.set(m.id || m.content + (m.sender || ""), m));
            map.forEach((m, key) => merged.set(key, m));
            return Array.from(merged.values());
        });
        setImportTxId("");
        setStatus(`Imported ${map.size} message(s).`);
    };


    // Polling for new messages
    useEffect(() => {
        if (!publicKey) return;
        getInboxMessages(false);
        const interval = window.setInterval(() => {
            getInboxMessages(false);
        }, 30000);
        return () => {
            clearInterval(interval);
        };
    }, [publicKey, getInboxMessages]);

    const decryptMessage = async (m: InboxMessage) => {
        if (!adapter?.decrypt && !viewKey) {
            alert("Wallet does not support decryption or is not connected, and no View Key provided.");
            return;
        }

        try {
            setStatus("Decrypting...");

            const ciphertext = m.cipherText || m.content;

            if (!ciphertext || typeof ciphertext !== 'string') {
                throw new Error("Invalid content to decrypt (not a string)");
            }

            let decryptedText: string | null = null;
            
            // 1. Try Decrypt (Wallet or ViewKey via helper)
            try {
                decryptedText = await decryptCiphertextToText(ciphertext, {
                    tpk: m.tpk,
                    programId: PROGRAM_ID,
                    functionName: "send_message",
                    indexes: typeof m.outputIndex === "number" ? [m.outputIndex] : [0, 1],
                });
            } catch(e) { console.warn("Helper decrypt failed", e); }

            // 2. Try View Key (Direct Fallback if helper returned null)
            if (!decryptedText && viewKey && viewKey.startsWith("AViewKey1")) {
                try {
                     const vk = ViewKey.from_string(viewKey);
                     const cleanCiphertext = sanitizeRecordString(ciphertext);
                     
                     console.log("ViewKey Decrypting (len=" + cleanCiphertext.length + "):", cleanCiphertext.slice(0, 30) + "...");
                     
                     let recordCiphertext;
                     try {
                        recordCiphertext = RecordCiphertext.fromString(cleanCiphertext);
                     } catch(e: any) {
                         // Try direct decrypt first before giving up
                         try {
                             console.log("Attempting direct vk.decrypt(string)...");
                             // @ts-ignore
                             const directDecrypted = vk.decrypt(cleanCiphertext);
                             if (directDecrypted) {
                                 decryptedText = directDecrypted.toString();
                                 console.log("Direct ViewKey Decrypt Success!");
                                 // Skip plaintext check if success
                             }
                         } catch (dErr) {
                             // console.warn("Direct vk.decrypt failed:", dErr);
                             
                             // If it fails, maybe it's already a plaintext record?
                             // Try parsing as plaintext just in case
                             console.warn("RecordCiphertext parse failed:", e.message);
                             try {
                                 const recordPlaintext = RecordPlaintext.fromString(cleanCiphertext);
                                 decryptedText = recordPlaintext.toString();
                                 console.log("Parsed as Plaintext Record directly.");
                             } catch(e2: any) {
                                 console.warn("RecordPlaintext parse failed:", e2.message);
                                 console.warn("Failed String Hex:", cleanCiphertext.split('').map(c => c.charCodeAt(0).toString(16)).join(' '));
                                 throw e; // Throw original error to show in status
                             }
                         }
                     }

                     if (recordCiphertext && recordCiphertext.isOwner(vk)) {
                         const recordPlaintext = recordCiphertext.decrypt(vk);
                         decryptedText = recordPlaintext.toString();
                     }

                     if (decryptedText) {
                         // Parse "content" field
                         // Example: { owner: ..., content: 12345field, ... }
                         const match = decryptedText.match(/content:\s*([^\s,.}]+)/);
                         if (match && match[1]) {
                            decryptedText = match[1];
                         }
                         setStatus("Decrypted via View Key!");
                     }
                } catch (e: any) { 
                    console.warn("ViewKey decrypt failed", e); 
                    setStatus("ViewKey decrypt failed: " + (e.message || e));
                }
            }

            if (!decryptedText) {
                setStatus("Decrypt failed (no access to this record).");
                return;
            }

            const decodedContent = parseMessageContent(decryptedText);
            const senderMatch = decryptedText.match(/sender:\s*([a-zA-Z0-9]+)/);
            const recipientMatch = decryptedText.match(/recipient:\s*([a-zA-Z0-9]+)/);
            const senderAddr = senderMatch?.[1] || "Unknown";
            const recipientAddr = recipientMatch?.[1] || "";

            const messageType = recipientAddr === publicKey ? "received" : "sent";
            const counterparty = messageType === "sent" ? recipientAddr : senderAddr;

            let displayName = counterparty;
            if (counterparty && profiles.has(counterparty)) {
                displayName = profiles.get(counterparty)?.name || counterparty;
            }
            if (displayName === counterparty && counterparty.length > 20) {
                displayName = counterparty.slice(0, 6) + "..." + counterparty.slice(-6);
            }

            setMessages(prev => prev.map(msg => {
                if (msg.id === m.id) {
                    return {
                        ...msg,
                        type: messageType,
                        sender: displayName,
                        content: decodedContent,
                        decryptedContent: decodedContent,
                        originalContent: decryptedText,
                        isDecrypted: true
                    };
                }
                return msg;
            }));
            setStatus("Decrypted!");
        } catch (e: unknown) {
            console.error("Decrypt error", e);
            setStatus("Decrypt failed: " + getErrorMessage(e));
        }
    };

    const toggleMessagePrivacy = (m: InboxMessage) => {
        setMessages(prev => prev.map(msg => {
            if (msg.id === m.id) {
                if (msg.isDecrypted) {
                    // Hide content
                    return {
                        ...msg,
                        content: msg.originalContent || "🔒 Encrypted",
                        isDecrypted: false
                    };
                } else {
                    // Show content
                    if (msg.decryptedContent) {
                        return {
                            ...msg,
                            content: msg.decryptedContent,
                            isDecrypted: true
                        };
                    }
                    return msg;
                }
            }
            return msg;
        }));
    };

    const renderStatusLinks = () => {
        return null;
    };

    return (
        <div style={{ padding: "20px" }}>

            {/* Advanced Sync Toggle */}
            <div style={{ marginBottom: "15px", textAlign: "right" }}>
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    style={{ background: "transparent", color: "#666", border: "none", textDecoration: "underline", fontSize: "12px", cursor: "pointer", padding: 0 }}
                >
                    {showAdvanced ? "Hide Advanced Sync Settings" : "Advanced Sync Settings"}
                </button>
                {showAdvanced && (
                    <div style={{ marginTop: "10px", padding: "15px", border: "1px dashed #aaa", borderRadius: "4px", background: "#f9f9f9", textAlign: "left" }}>
                        <p style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: "bold" }}>Deep Sync (SDK)</p>
                        <p style={{ fontSize: "12px", color: "#555", marginBottom: "8px" }}>
                            If the wallet sync is incomplete, provide your View Key to scan the blockchain directly.
                            Your key is used locally and never stored or transmitted.
                        </p>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                            <input
                                type="password"
                                placeholder="Enter View Key (AViewKey1...)"
                                value={viewKeyInput}
                                onChange={(e) => setViewKeyInput(e.target.value)}
                                style={{ flex: 1, padding: "8px", fontFamily: "monospace", border: "1px solid #ccc" }}
                            />
                            <button
                                onClick={() => {
                                    if (!viewKeyInput.trim()) {
                                        setViewKey("");
                                        alert("View Key cleared.");
                                        return;
                                    }
                                    if (!viewKeyInput.startsWith("AViewKey1")) {
                                        alert("Invalid View Key format. Must start with AViewKey1...");
                                        return;
                                    }
                                    setViewKey(viewKeyInput.trim());
                                    alert("View Key Applied successfully! It will be used for decryption.");
                                }}
                                style={{ padding: "8px 15px", cursor: "pointer", background: "#333", color: "white", border: "none", borderRadius: "4px" }}
                            >
                                Apply
                            </button>
                        </div>
                        {viewKey && (
                            <div style={{ marginTop: "5px", color: "green", fontSize: "12px", fontWeight: "bold" }}>
                                ✓ View Key Active
                            </div>
                        )}

                        <hr style={{ margin: "15px 0", border: "0", borderTop: "1px dashed #ccc" }} />
                        
                        <p style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: "bold" }}>Manual Transaction Import</p>
                        <p style={{ fontSize: "12px", color: "#555", marginBottom: "8px" }}>
                            If a transaction is missing, paste its ID here (at1...) to import it manually.
                        </p>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                            <input
                                placeholder="Transaction ID (at1...)"
                                value={importTxId}
                                onChange={(e) => setImportTxId(e.target.value)}
                                style={{ flex: 1, padding: "8px", fontFamily: "monospace", border: "1px solid #ccc" }}
                            />
                            <button
                                onClick={async () => {
                                    if (!importTxId.trim()) return;
                                    setStatus("Importing transaction...");
                                    try {
                                        const tempMap = new Map<string, InboxMessage>();
                                        const res = await addMessagesFromTxId(importTxId.trim(), tempMap);
                                        
                                        if (tempMap.size > 0) {
                                             setMessages(prev => {
                                                const merged = new Map<string, InboxMessage>();
                                                prev.forEach(m => merged.set(m.id || m.content + (m.sender || ""), m));
                                                tempMap.forEach((m, key) => merged.set(key, m));
                                                return Array.from(merged.values());
                                            });
                                            setStatus("Transaction imported successfully!");
                                            alert(`Success! Imported ${tempMap.size} message(s).`);
                                            setImportTxId(""); // Clear input
                                        } else {
                                            setStatus("Transaction found but no messages.");
                                            alert("Transaction found, but no relevant messages for you were found inside it (or decryption failed).");
                                        }
                                    } catch (e) {
                                        console.error(e);
                                        setStatus("Failed to import transaction.");
                                        alert("Failed to import: " + getErrorMessage(e));
                                    }
                                }}
                                style={{ padding: "8px 15px", cursor: "pointer", background: "#333", color: "white", border: "none", borderRadius: "4px" }}
                            >
                                Import
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="section-block">
                <h3>Your Profile</h3>
                {fetchedProfile ? (
                    <div style={{ marginBottom: "15px" }}>
                        <p style={{ margin: "5px 0" }}><strong>Name:</strong> {fetchedProfile.name}</p>
                        <p style={{ margin: "5px 0" }}><strong>Bio:</strong> {fetchedProfile.bio}</p>
                    </div>
                ) : (
                    <p>No profile found locally.</p>
                )}

                {!isEditingProfile ? (
                    <button onClick={() => setIsEditingProfile(true)}>
                        Create/Update Profile
                    </button>
                ) : (
                    <div style={{ marginTop: "15px", borderTop: "2px dashed #ccc", paddingTop: "15px" }}>
                        <label>Enter New Details:</label>
                        <input
                            placeholder="Name"
                            value={profileName}
                            onChange={e => setProfileName(e.target.value)}
                        />
                        <input
                            placeholder="Bio"
                            value={profileBio}
                            onChange={e => setProfileBio(e.target.value)}
                        />
                        <div style={{ display: "flex", gap: "10px" }}>
                            <button onClick={async () => { await handleCreateProfile(); setIsEditingProfile(false); }}>
                                Save Profile
                            </button>
                            <button onClick={() => setIsEditingProfile(false)} style={{ background: "#eee" }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="section-block">
                <h3>Send Message</h3>
                <label>Recipient:</label>
                <input
                    placeholder="Recipient Address (aleo1...)"
                    value={recipient}
                    onChange={e => setRecipient(e.target.value)}
                />
                <label>Message:</label>
                <textarea
                    placeholder="Type your message..."
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    style={{
                        width: "100%",
                        height: "100px",
                        display: "block",
                        marginBottom: "15px",
                        padding: "12px",
                        background: "#fff",
                        color: "#000",
                        border: "2px solid #000",
                        fontFamily: "Space Mono, monospace",
                        fontSize: "1rem",
                        boxSizing: "border-box"
                    }}
                />
                <button onClick={sendMessage}>Send Message</button>
            </div>



            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "20px" }}>
                <div className="section-block">
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "15px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h2 className="section-title" style={{ margin: 0 }}>INBOX</h2>
                            <div style={{ fontSize: "0.8em", color: "#666" }}>
                                {lastSyncTime ? lastSyncTime.toLocaleTimeString() : "Never"}
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <input
                                placeholder="Paste txId (at...)"
                                value={importTxId}
                                onChange={(e) => setImportTxId(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: "8px",
                                    fontSize: "12px",
                                    border: "2px solid #000",
                                    background: "#fff",
                                    minWidth: 0
                                }}
                            />
                            <button
                                onClick={handleImportTx}
                                disabled={!importTxId || isSyncing}
                                style={{
                                    whiteSpace: "nowrap",
                                    padding: "8px 12px",
                                    background: !importTxId || isSyncing ? "#ccc" : "#fff",
                                    color: "#000",
                                    border: "2px solid #000",
                                    cursor: !importTxId || isSyncing ? "not-allowed" : "pointer",
                                    fontSize: "11px",
                                }}
                            >
                                IMPORT
                            </button>
                            <button
                                onClick={() => getInboxMessages(true)}
                                disabled={isSyncing}
                                style={{
                                    whiteSpace: "nowrap",
                                    padding: "8px 16px",
                                    background: isSyncing ? "#ccc" : "#000",
                                    color: "#fff",
                                    border: "2px solid #000",
                                    cursor: isSyncing ? "not-allowed" : "pointer"
                                }}
                                title="Scan blockchain for new messages"
                            >
                                {isSyncing ? "SCANNING..." : "SYNC & SCAN"}
                            </button>
                        </div>
                    </div>

                    {messages.length > 0 ? (
                        <ul className="inbox-list fade-in">
                            {[...messages].reverse().map((m, idx) => (
                                <li key={m.id || idx} className="list-item">
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8em", color: "#666", marginBottom: "5px" }}>
                                        <span><strong>{m.type === "sent" ? "To:" : "From:"}</strong> {m.sender ? (m.sender.length > 20 ? m.sender.slice(0, 6) + "..." + m.sender.slice(-6) : m.sender) : "Unknown"}</span>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <span>{m.id ? m.id.slice(0, 6) + "..." : ""}</span>
                                            <button
                                                onClick={() => {
                                                    if (m.isDecrypted) {
                                                        toggleMessagePrivacy(m);
                                                    } else {
                                                        if (m.decryptedContent) {
                                                            toggleMessagePrivacy(m);
                                                        } else {
                                                            decryptMessage(m);
                                                        }
                                                    }
                                                }}
                                                style={{
                                                    background: "none",
                                                    border: "none",
                                                    cursor: "pointer",
                                                    fontSize: "1.2em",
                                                    padding: "0 5px"
                                                }}
                                                title={m.isDecrypted ? "Encrypt (Hide)" : "Decrypt (Show)"}
                                            >
                                                {m.isDecrypted ? "🔓" : "🔒"}
                                            </button>
                                        </div>
                                    </div>

                                    {m.isDecrypted ? (
                                        <div style={{ marginTop: "5px", padding: "10px", background: "#f1f8e9", borderLeft: "4px solid #4caf50", borderRadius: "4px" }}>
                                            <strong>Message:</strong><br />
                                            <span style={{ fontSize: "1.1em" }}>{parseMessageContent(m.content)}</span>
                                        </div>
                                    ) : (
                                        <div style={{ marginTop: "5px", padding: "10px", background: "#f5f5f5", borderLeft: "4px solid #999", borderRadius: "4px", color: "#666" }}>
                                            <strong>Encrypted Message:</strong><br />
                                            <span style={{ fontStyle: "italic", fontSize: "0.9em" }}>{m.content.includes("field") ? "Ciphertext: " + m.content.slice(0, 15) + "..." : "🔒 Content Hidden"}</span>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>No messages found or not synced.</p>
                    )}
                </div>

                <div className="section-block">
                    <h3>📤 Sent History</h3>
                    {sentHistory.length > 0 ? (
                        <ul className="history-list fade-in">
                            {sentHistory.map((item, idx) => (
                                <li key={idx} className="list-item">
                                    <strong>{item.type}</strong> <br />
                                    <span style={{ fontSize: "0.8em", color: "#666" }}>
                                        {new Date(item.timestamp).toLocaleTimeString()}
                                    </span><br />
                                    To: {item.recipient ? item.recipient.slice(0, 6) + "..." : "System"} <br />

                                    {(item.txId.startsWith("at1") || item.txId.startsWith("au1")) ? (
                                        <>
                                            TxID: {item.txId.startsWith("at1") ? item.txId.slice(0, 10) + "..." : item.txId} <br />
                                            <div style={{ marginTop: "5px" }}>
                                                <a href={`https://testnet.aleoscan.io/${item.txId.startsWith("au1") ? "transition" : "transaction"}?id=${item.txId}`} target="_blank" rel="noreferrer" style={{ fontSize: "0.8em", marginRight: "10px" }}>
                                                    [AleoScan]
                                                </a>
                                                <a href={`https://testnet.explorer.provable.com/transaction/${item.txId}`} target="_blank" rel="noreferrer" style={{ fontSize: "0.8em" }}>
                                                    [Provable]
                                                </a>
                                            </div>
                                        </>
                                    ) : (
                                        (item.status === "Success") ? (
                                            <div style={{ fontSize: "0.8em", color: "green", marginTop: "5px" }}>
                                                ✅ Mined (Task ID: {item.txId.slice(0, 8)}...)<br />
                                                <span style={{ fontSize: "0.7em", color: "#666" }}>ID not returned by wallet yet.</span><br />
                                                <div style={{ marginTop: "5px" }}>
                                                    <span style={{ fontSize: "0.8em", color: "#555" }}>Find in Activity:</span><br />
                                                    <a href={`https://testnet.aleoscan.io/address?a=${publicKey}`} target="_blank" rel="noreferrer" style={{ fontSize: "0.8em", marginRight: "10px", textDecoration: "underline" }}>
                                                        [AleoScan]
                                                    </a>
                                                    <a href={`https://testnet.explorer.provable.com/address/${publicKey}`} target="_blank" rel="noreferrer" style={{ fontSize: "0.8em", textDecoration: "underline" }}>
                                                        [Provable]
                                                    </a>
                                                </div>
                                            </div>
                                        ) : (item.status === "Unknown") ? (
                                            <div style={{ fontSize: "0.8em", color: "#666", marginTop: "5px" }}>
                                                ❓ Status Unknown<br />
                                                <span style={{ fontSize: "0.7em", color: "#999" }}>Wallet stopped tracking this task.</span><br />
                                                <div style={{ marginTop: "5px" }}>
                                                    <a href={`https://testnet.aleoscan.io/address?a=${publicKey}`} target="_blank" rel="noreferrer" style={{ fontSize: "0.8em", marginRight: "10px", textDecoration: "underline" }}>
                                                        [Check AleoScan]
                                                    </a>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: "0.8em", color: "#d32f2f" }}>
                                                ⏳ Request Pending (Task ID)<br />
                                                <span style={{ color: "#999", fontSize: "0.8em" }}>ID: {item.txId.slice(0, 8)}...</span><br />
                                                <span className="loader" style={{ width: "10px", height: "10px", borderTopColor: "#d32f2f", margin: "5px 0" }}></span>
                                                Waiting for blockchain... <br />

                                                {/* Manual Recovery Option */}
                                                <a href={`https://testnet.aleoscan.io/address?a=${publicKey}`} target="_blank" rel="noreferrer" style={{ color: "#555", textDecoration: "underline", fontSize: "0.9em", marginTop: "5px", display: "inline-block" }}>
                                                    Check Explorer for Updates
                                                </a>
                                            </div>
                                        )
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>No sent messages yet.</p>
                    )}
                </div>
            </div >

            <div className="status-box">
                <p style={{ fontWeight: "bold", background: "#000", color: "#fff", display: "inline-block", padding: "2px 5px" }}>
                    Status: {status}
                    {(status.includes("Signing") || status.includes("Initiated") || status.includes("Processing")) && <span className="loader" style={{ marginLeft: "10px", borderTopColor: "#fff", width: "12px", height: "12px" }}></span>}
                </p>
                {renderStatusLinks()}
            </div>


        </div >
    );
};

function App() {
    const [network, setNetwork] = useState(WalletAdapterNetwork.TestnetBeta);

    const wallets = useMemo(
        () => [
            new LeoWalletAdapter({
                appName: "Private Messenger App",
            }),
            new PuzzleWalletAdapter({
                appName: "Private Messenger App",
                programIdPermissions: {
                    [WalletAdapterNetwork.TestnetBeta]: [PROGRAM_ID],
                    [WalletAdapterNetwork.MainnetBeta]: [PROGRAM_ID]
                }
            }),
        ],
        []
    );

    return (
        <WalletProvider
            wallets={wallets}
            decryptPermission={DecryptPermission.OnChainHistory}
            network={network}
            programs={[PROGRAM_ID]}
            autoConnect
        >
            <div className="App">
                <h1>Aleo Private Messenger</h1>

                <div style={{ marginBottom: "20px", padding: "12px 20px", background: "#fff", border: "2px solid #000", display: "inline-block" }}>
                    <label style={{ marginRight: "15px", fontWeight: "bold", fontFamily: "Space Mono, monospace" }}>NETWORK:</label>
                    <select
                        value={network}
                        onChange={(e) => setNetwork(e.target.value as WalletAdapterNetwork)}
                        style={{
                            padding: "8px 12px",
                            border: "2px solid #000",
                            background: "#fff",
                            color: "#000", // Ensure text is black
                            fontFamily: "Space Mono, monospace",
                            fontSize: "0.9em",
                            cursor: "pointer",
                            fontWeight: "bold",
                            appearance: "auto" // Ensure standard dropdown appearance
                        }}
                    >
                        <option value={WalletAdapterNetwork.TestnetBeta} style={{ color: "#000", background: "#fff" }}>TESTNET BETA</option>
                        <option value={WalletAdapterNetwork.MainnetBeta} style={{ color: "#000", background: "#fff" }}>MAINNET BETA</option>
                    </select>
                </div>

                <div className="card">
                    <WalletConnectButton network={network} />
                </div>
                <MessengerUI network={network} />
            </div>
        </WalletProvider>
    );
}

export default App;
