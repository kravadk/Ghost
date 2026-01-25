# Инструкция по деплою на Netlify

## Вариант 1: Через веб-интерфейс Netlify (Рекомендуется)

1. Перейдите на https://app.netlify.com
2. Нажмите "Add new site" → "Import an existing project"
3. Выберите "GitHub" и авторизуйтесь
4. Выберите репозиторий: `Dima4663737373/private-messanger`
5. Настройте сборку:
   - **Base directory**: `frontend`
   - **Build command**: `npm install --legacy-peer-deps && npm run build`
   - **Publish directory**: `frontend/dist`
6. Нажмите "Deploy site"

После этого Netlify будет автоматически деплоить при каждом push в main ветку.

## Вариант 2: Через Netlify CLI (если исправить проблему)

Если Netlify CLI работает корректно, можно использовать:

```bash
# Создать и задеплоить новый сайт
netlify deploy --create-site <уникальное-имя> --dir=frontend/dist --prod

# Или привязать к существующему сайту
netlify link
netlify deploy --dir=frontend/dist --prod
```

## Текущий статус

✅ Код запушен в GitHub: `https://github.com/Dima4663737373/private-messanger.git`
✅ Проект собран: `frontend/dist/`
✅ Конфигурация Netlify готова: `netlify.toml`

## Важно

После деплоя убедитесь, что:
- Программа ID обновлена в `frontend/src/deployed_program.ts` (текущая версия: `priv_messenger_leotest_009.aleo`)
- Все функции работают корректно
