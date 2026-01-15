interface CachedTransaction {
    txId: string;
    height: number;
    sender: string;
    recipient: string;
    content: string;
    timestamp: number;
    cachedAt: number; // Date.now()
}

interface UserCache {
    transactions: CachedTransaction[];
    lastUpdated: number;
}

const CACHE_KEY = "priv_messenger_tx_cache";
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 днів

export const TxCache = {
    // Зберегти транзакції
    save(address: string, transactions: CachedTransaction[]): void {
        try {
            const cache = this.getAll();
            cache[address] = {
                transactions,
                lastUpdated: Date.now(),
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
            console.log(`💾 Saved ${transactions.length} transactions to cache for ${address.slice(0, 8)}...`);
        } catch (error) {
            console.error("Failed to save tx cache:", error);
        }
    },

    // Отримати транзакції для адреси
    get(address: string): CachedTransaction[] {
        try {
            const cache = this.getAll();
            const userCache = cache[address];
            
            if (!userCache) {
                return [];
            }
            
            // Перевірка на застарілість
            if (Date.now() - userCache.lastUpdated > CACHE_DURATION) {
                console.log("⏰ Cache expired, clearing...");
                this.clear(address);
                return [];
            }
            
            return userCache.transactions;
        } catch (error) {
            console.error("Failed to load tx cache:", error);
            return [];
        }
    },

    // Отримати всі кеші
    getAll(): Record<string, UserCache> {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            return cached ? JSON.parse(cached) : {};
        } catch {
            return {};
        }
    },

    // Очистити кеш для адреси
    clear(address: string): void {
        try {
            const cache = this.getAll();
            delete cache[address];
            localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
            console.log(`🗑️  Cleared cache for ${address.slice(0, 8)}...`);
        } catch (error) {
            console.error("Failed to clear tx cache:", error);
        }
    },

    // Додати нові транзакції до існуючих
    append(address: string, newTransactions: CachedTransaction[]): void {
        const existing = this.get(address);
        const combined = [...existing, ...newTransactions];
        
        // Видалити дублікати по txId
        const unique = combined.filter(
            (tx, index, self) => self.findIndex(t => t.txId === tx.txId) === index
        );
        
        // Сортувати по timestamp (новіші спочатку)
        unique.sort((a, b) => b.timestamp - a.timestamp);
        
        this.save(address, unique);
    },

    // Отримати останній час оновлення
    getLastUpdated(address: string): number | null {
        try {
            const cache = this.getAll();
            const userCache = cache[address];
            return userCache?.lastUpdated || null;
        } catch {
            return null;
        }
    }
};

