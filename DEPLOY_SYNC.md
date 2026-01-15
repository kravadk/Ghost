# Деплой оновленого контракту з оптимізованою функцією sync

## Що було зроблено

### 1. Оптимізація смарт-контракту
- Контракт залишився без змін (mapping API вже надає всю необхідну функціональність)
- Індексація повідомлень через `message_count` та `message_index` mappings працює коректно

### 2. Оптимізація фронтенду
- **Спрощена функція `getInboxMessages()`** - прибрано зайвий код та дублювання
- **Покращена логіка sync**:
  - Спочатку перевіряє `message_count` через mapping API
  - Сканує тільки нові блоки (зменшено з 5000 до 2000 для продуктивності)
  - Об'єднує повідомлення з гаманця та з блокчейну
- **Прибрано зайві useEffect** - видалено дублювання коду для збереження повідомлень
- **Видалено невикористаний код** - прибрано `syncUtils.ts`

### 3. Покращення функції sync
- Використовує mapping API для швидкого визначення кількості нових повідомлень
- Зберігає останній синхронізований індекс в localStorage
- Сканує блоки тільки якщо є нові повідомлення
- Обмежує кількість перевірених транзакцій (до 500 в localStorage)

## ✅ Деплой виконано успішно!

**Transaction ID:** `at1rvq5qqkz26zs9deht4jkxtzdut02f6htke5hd8khcxvguw36cgrs0anl28`  
**Fee Transaction ID:** `at189zpn75e3q78649hurwlmrrr270x2pmyy0zwqs26un5hlecxuuqqcc362q`  
**Fee ID:** `au12v3dammvdkyhk4wt3md6rk8crq5rr0cljrr30pufc63gl967tyqq5gnj89`

**Перевірити на:**
- [AleoScan Testnet](https://testnet.aleoscan.io/transaction?id=at1rvq5qqkz26zs9deht4jkxtzdut02f6htke5hd8khcxvguw36cgrs0anl28)
- [Provable Explorer](https://testnet.explorer.provable.com/transaction/at1rvq5qqkz26zs9deht4jkxtzdut02f6htke5hd8khcxvguw36cgrs0anl28)

---

## Команда для деплою (для майбутніх оновлень)

### 1. Перевірте, що контракт скомпільовано
```bash
cd C:\Users\Leonid\private_messenger
leo build
```

Має вивести: `✅ Compiled 'priv_messenger_leotest_007.aleo' into Aleo instructions.`

### 2. Деплой на Testnet (PowerShell)

```powershell
# Встановіть свій приватний ключ
$env:PRIVATE_KEY="your_private_key_here"

# Деплой з усіма необхідними параметрами
leo deploy --network testnet --endpoint https://api.explorer.provable.com/v1 --priority-fees 1000000 --consensus-version 11 --yes --broadcast
```

**Важливі параметри:**
- `--network testnet` - мережа для деплою
- `--endpoint https://api.explorer.provable.com/v1` - endpoint для API
- `--priority-fees 1000000` - пріоритетна комісія (1 кредит = 1,000,000 microcredits)
- `--consensus-version 11` - версія консенсусу
- `--yes` - автоматичне підтвердження
- `--broadcast` - автоматичне відправлення транзакції

**Вартість деплою:**
- Transaction Storage: 3.314 credits
- Program Synthesis: 0.212 credits
- Namespace: 1.000 credits
- Constructor: 0.002 credits
- Priority Fee: 1.000 credits
- **Total Fee: 5.528 credits**

### 3. Після деплою

1. **Перевірте PROGRAM_ID у фронтенді**:
   - Файл: `frontend/src/deployed_program.ts`
   - Має бути: `export const PROGRAM_ID = "priv_messenger_leotest_007.aleo";`
   - Якщо все правильно, нічого змінювати не потрібно ✅

2. **Очистіть localStorage** (опціонально, для тестування):
   ```javascript
   // В консолі браузера (F12)
   localStorage.clear();
   ```

3. **Перезапустіть frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

4. **Перевірте роботу sync**:
   - Підключіть гаманець до сайту
   - Натисніть кнопку "SYNC"
   - Перевірте консоль браузера (F12) на наявність помилок
   - Переконайтеся, що нові повідомлення з'являються в inbox
   - Відправте тестове повідомлення собі та перевірте, що воно з'являється після sync

## Як працює оптимізована sync

1. **Перевірка message_count**: Функція отримує кількість повідомлень для адреси через mapping API
2. **Визначення нових повідомлень**: Порівнює поточну кількість з останнім синхронізованим індексом
3. **Сканування блоків**: Якщо є нові повідомлення, сканує останні 2000 блоків
4. **Обробка транзакцій**: Знаходить транзакції з функцією `send_message` та обробляє їх
5. **Розшифрування**: Використовує wallet adapter для розшифрування records
6. **Збереження**: Оновлює localStorage з новими повідомленнями та останнім індексом

## API Endpoints для sync

Frontend використовує:
1. `/program/{PROGRAM_ID}/mapping/message_count/{address}` - отримати кількість повідомлень
2. `/program/{PROGRAM_ID}/mapping/message_index/{key}` - отримати метадані повідомлення (не використовується напряму, але доступне)
3. `/block/{height}` - отримати блок за висотою
4. `/transaction/{txId}` або `/transition/{transitionId}` - отримати транзакцію/transition

## Перевірка роботи

### 1. Перевірка деплою
Після успішного деплою, перевірте транзакцію:
- Transaction ID: `at1rvq5qqkz26zs9deht4jkxtzdut02f6htke5hd8khcxvguw36cgrs0anl28`
- Перевірте на [AleoScan Testnet](https://testnet.aleoscan.io/transaction?id=at1rvq5qqkz26zs9deht4jkxtzdut02f6htke5hd8khcxvguw36cgrs0anl28)
- Або на [Provable Explorer](https://testnet.explorer.provable.com/transaction/at1rvq5qqkz26zs9deht4jkxtzdut02f6htke5hd8khcxvguw36cgrs0anl28)

### 2. Перевірка mapping через API
```bash
# Отримати кількість повідомлень для адреси
curl "https://api.explorer.provable.com/v1/testnet/program/priv_messenger_leotest_007.aleo/mapping/message_count/aleo1..."
```

Має повернути щось типу: `"1u64"` або `"0u64"` якщо повідомлень немає.

### 3. Тестування sync функції
1. Відкрийте frontend: `cd frontend && npm run dev`
2. Підключіть гаманець
3. Відправте тестове повідомлення на свою адресу
4. Натисніть кнопку "SYNC"
5. Перевірте, що повідомлення з'явилося в inbox

## Примітки

- Sync функція тепер працює швидше завдяки використанню mapping API
- Зменшено кількість сканованих блоків з 5000 до 2000 для покращення продуктивності
- Зберігається тільки останні 500 перевірених транзакцій в localStorage
- Всі зайві функції та дублювання коду прибрано

