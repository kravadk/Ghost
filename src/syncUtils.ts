// frontend/src/syncUtils.ts

/**
 * Виправлена функція для виклику Aleo RPC з множинними endpoints
 */
export async function callAleoRpc(method: string, params?: any): Promise<any> {
    const API_ENDPOINTS = [
        'https://api.explorer.provable.com/v1/testnet',
        'https://api.explorer.aleo.org/v1/testnet',
        'https://testnet3.aleorpc.com'
    ];

    let lastError: Error | null = null;

    for (const baseUrl of API_ENDPOINTS) {
        try {
            console.log(`🔗 Trying endpoint: ${baseUrl}/${method}`);

            const url = `${baseUrl}/${method}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ Success with ${baseUrl}`);
            return data;

        } catch (error) {
            console.warn(`❌ Failed for ${baseUrl}:`, error);
            lastError = error as Error;
            continue;
        }
    }

    throw new Error(`All RPC endpoints failed. Last error: ${lastError?.message}`);
}

/**
 * Отримати поточну висоту блокчейну
 */
export async function getLatestBlockHeight(): Promise<number> {
    try {
        const data = await callAleoRpc('latest/height');
        return typeof data === 'number' ? data : data.height || data.result;
    } catch (error) {
        console.error('Failed to get latest block height:', error);
        throw error;
    }
}

/**
 * Отримати блок за висотою
 */
export async function getBlockByHeight(height: number): Promise<any> {
    try {
        return await callAleoRpc(`block/${height}`);
    } catch (error) {
        console.error(`Failed to get block ${height}:`, error);
        return null;
    }
}

/**
 * Отримати діапазон блоків
 */
export async function getBlockRange(
    startHeight: number,
    endHeight: number
): Promise<any[]> {
    const blocks: any[] = [];

    for (let height = startHeight; height <= endHeight; height++) {
        try {
            const block = await getBlockByHeight(height);
            if (block) {
                blocks.push(block);
            }
        } catch (error) {
            console.warn(`Skipping block ${height} due to error`);
        }
    }

    return blocks;
}

/**
 * Витягти всі records з блоку
 */
export function extractRecordsFromBlock(block: any): any[] {
    const records: any[] = [];

    if (!block || !block.transactions) {
        return records;
    }

    for (const tx of block.transactions) {
        if (tx.execution && tx.execution.transitions) {
            for (const transition of tx.execution.transitions) {
                if (transition.outputs) {
                    for (const output of transition.outputs) {
                        if (output.type === 'record' && output.value) {
                            records.push({
                                ciphertext: output.value,
                                programId: transition.program,
                                functionName: transition.function,
                                transactionId: tx.id,
                                blockHeight: block.header.metadata.height,
                                timestamp: block.header.metadata.timestamp
                            });
                        }
                    }
                }
            }
        }
    }

    return records;
}

/**
 * Розшифрувати record використовуючи view key (заглушка)
 * ЦЮ ФУНКЦІЮ ПОТРІБНО ЗАМІНИТИ НА РЕАЛЬНУ ЛОГІКУ З ALEO SDK
 */
export function tryDecryptRecord(
    recordCiphertext: string,
    viewKey: string
): any | null {
    try {
        // TODO: Використати Aleo SDK для розшифрування
        // Наразі це заглушка

        // Перевірити чи є Aleo SDK
        // @ts-ignore
        if (typeof window.AleoSDK !== 'undefined') {
            // @ts-ignore
            const sdk = window.AleoSDK;
            // Тут має бути логіка розшифрування через SDK
            console.log('Aleo SDK available, decrypt record');
        }

        return null; // Поки що повертаємо null
    } catch (error) {
        return null;
    }
}

/**
 * Головна функція синхронізації повідомлень
 */
export async function syncMessagesFromBlockchain(
    viewKey: string,
    programId: string,
    lastSyncedHeight?: number
): Promise<{
    success: boolean;
    newMessages: any[];
    lastSyncedHeight: number;
    messagesCount: number;
    error?: string;
}> {
    console.log('🔄 Starting blockchain sync...');

    try {
        // 1. Отримати поточну висоту
        const latestHeight = await getLatestBlockHeight();
        console.log(`📊 Latest block height: ${latestHeight}`);

        // 2. Визначити діапазон
        const SCAN_RANGE = 500; // Сканувати останні 500 блоків або з lastSynced
        const startHeight = lastSyncedHeight
            ? lastSyncedHeight + 1
            : Math.max(0, latestHeight - SCAN_RANGE);

        const endHeight = latestHeight;

        console.log(`🔍 Scanning blocks ${startHeight} to ${endHeight}`);

        if (startHeight >= endHeight) {
            console.log('✅ Already up to date');
            return {
                success: true,
                newMessages: [],
                lastSyncedHeight: latestHeight,
                messagesCount: 0
            };
        }

        const newMessages: any[] = [];

        // 3. Сканувати блоки (по 10 за раз щоб не перевантажувати)
        const BATCH_SIZE = 10;

        for (let height = startHeight; height <= endHeight; height += BATCH_SIZE) {
            const batchEnd = Math.min(height + BATCH_SIZE - 1, endHeight);
            console.log(`⏳ Processing blocks ${height} - ${batchEnd}...`);

            try {
                const blocks = await getBlockRange(height, batchEnd);

                for (const block of blocks) {
                    // Витягти records з блоку
                    const records = extractRecordsFromBlock(block);

                    // Фільтрувати тільки records від нашої програми
                    const relevantRecords = records.filter(
                        r => r.programId === programId
                    );

                    console.log(`📦 Found ${relevantRecords.length} records from ${programId}`);

                    // Спробувати розшифрувати кожен record
                    for (const record of relevantRecords) {
                        const decrypted = tryDecryptRecord(record.ciphertext, viewKey);

                        if (decrypted) {
                            console.log('✉️ Found new message!');
                            newMessages.push({
                                ...decrypted,
                                blockHeight: record.blockHeight,
                                transactionId: record.transactionId,
                                timestamp: record.timestamp
                            });
                        }
                    }
                }

                // Затримка між batch-ами
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (batchError) {
                console.error(`Error processing batch ${height}-${batchEnd}:`, batchError);
                continue;
            }
        }

        console.log(`✅ Sync complete. Found ${newMessages.length} new messages`);

        return {
            success: true,
            newMessages,
            lastSyncedHeight: latestHeight,
            messagesCount: newMessages.length
        };

    } catch (error) {
        console.error('❌ Sync failed:', error);
        return {
            success: false,
            newMessages: [],
            lastSyncedHeight: lastSyncedHeight || 0,
            messagesCount: 0,
            error: (error as Error).message
        };
    }
}

/**
 * Парсити повідомлення з розшифрованого record
 */
export function parseMessageFromRecord(recordData: any): any | null {
    try {
        // Структура вашого record може відрізнятися
        // Адаптуйте під ваш формат
        return {
            sender: recordData.sender || recordData.from,
            content: recordData.message || recordData.content,
            timestamp: recordData.timestamp || Date.now()
        };
    } catch (error) {
        console.error('Failed to parse message:', error);
        return null;
    }
}