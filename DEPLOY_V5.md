# Деплой priv_mess_v5.aleo

## Що нового в v5

### Нові можливості:
1. **Індексація повідомлень на блокчейні** - тепер кожне повідомлення індексується в mapping
2. **Швидкий пошук** - можна отримати кількість повідомлень та їх метадані через API
3. **Відстеження відправника** - sender зберігається в індексі

### Нові mappings:
- `message_count: address => u64` - кількість повідомлень для адреси
- `message_index: field => MessageMeta` - метадані повідомлення (sender, content_hash, timestamp)

## Кроки для деплою

### 1. Перевірте, що контракт скомпільовано
```bash
cd C:\Users\Leonid\private_messenger
leo build
```

### 2. Деплой на Testnet
```bash
# Встановіть свій приватний ключ
set PRIVATE_KEY=your_private_key_here

# Деплой
leo deploy --network testnet --private-key %PRIVATE_KEY%
```

Або через snarkOS:
```bash
snarkos developer deploy priv_mess_v5.aleo ^
  --private-key %PRIVATE_KEY% ^
  --query https://api.explorer.provable.com/v1 ^
  --path build/ ^
  --broadcast https://api.explorer.provable.com/v1/testnet/transaction/broadcast ^
  --fee 5000000 ^
  --record <your_fee_record>
```

### 3. Після деплою

1. Очистіть localStorage в браузері:
```javascript
localStorage.clear();
```

2. Перезапустіть frontend:
```bash
cd frontend
npm run dev
```

3. Підключіть гаманець і відправте тестове повідомлення

## Перевірка роботи

Після відправки повідомлення, перевірте mapping через API:

```bash
# Отримати кількість повідомлень для адреси
curl "https://api.explorer.provable.com/v1/testnet/program/priv_mess_v5.aleo/mapping/message_count/aleo1..."

# Має повернути щось типу: "1u64"
```

## Структура MessageMeta

Кожне повідомлення зберігає:
- `sender: address` - адреса відправника
- `content_hash: field` - хеш контенту (BHP256)
- `timestamp: u64` - висота блоку на момент відправки

## API Endpoints для sync

Frontend використовує:
1. `/program/priv_mess_v5.aleo/mapping/message_count/{address}` - отримати кількість повідомлень
2. `/program/priv_mess_v5.aleo/mapping/message_index/{key}` - отримати метадані повідомлення
3. Сканування блоків - для отримання ciphertext та розшифровки

