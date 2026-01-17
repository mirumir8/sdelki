# Sdelki - AmoCRM Webhook Processor

Автоматическая обработка сделок в AmoCRM:
1. Удаляет префикс "Автосделка:" из названия сделки
2. Удаляет символ "@" в начале значения кастомного поля контакта с ID 1018087

## Установка

1. Клонировать репозиторий:
```bash
git clone https://github.com/mirumir8/sdelki.git
cd sdelki
```

2. Установить зависимости:
```bash
npm install
```

3. Создать `.env` файл (используйте `.env.example` как шаблон):
```env
SUBDOMAIN=your_subdomain
ACCESS_TOKEN=your_access_token
INTEGRATION_ID=your_integration_id
PORT=3001
```

4. Запустить:
```bash
npm start
```

## Использование с PM2

### Запуск обоих аккаунтов

Приложение настроено для работы с двумя аккаунтами AmoCRM одновременно:

1. Создайте `.env` файл с токенами обоих аккаунтов:
```env
NEMOCREW_ACCESS_TOKEN=your_nemocrew_token
NEMOCREW_INTEGRATION_ID=f375fa4e-96b6-40a6-8d00-5e376eb2993a

PROFIMATIKA_ACCESS_TOKEN=your_profimatika_token
PROFIMATIKA_INTEGRATION_ID=your_profimatika_integration_id
```

2. Запустите оба процесса:
```bash
pm2 start ecosystem.config.js
pm2 save
```

Это запустит два процесса:
- `sdelki-nemocrew` на порту 3001
- `sdelki-profimatika` на порту 3002

### Запуск отдельных аккаунтов

Если нужен только один аккаунт:
```bash
# Только nemocrew
pm2 start ecosystem.config.js --only sdelki-nemocrew

# Только profimatika
pm2 start ecosystem.config.js --only sdelki-profimatika
```

## Webhook URLs

После запуска webhook URL для каждого аккаунта:

| Аккаунт | Webhook URL | Порт |
|---------|-------------|------|
| nemocrew | `http://45.8.99.161:3001/webhook` | 3001 |
| profimatika | `http://45.8.99.161:3002/webhook` | 3002 |

**ВАЖНО:** Порты фиксированные, поэтому webhook URLs не будут меняться при перезапуске.

## Настройка webhook в AmoCRM

1. Перейдите в настройки интеграции в AmoCRM
2. Укажите webhook URL: `http://45.8.99.161:3001/webhook`
3. Включите события:
   - Создание сделки (`leads.add`)
   - Изменение статуса сделки (`leads.status`)

## Логирование

Логи доступны через PM2:
```bash
pm2 logs sdelki
pm2 logs sdelki --lines 100
```

## Health Check

Проверка работоспособности:
```bash
curl http://45.8.99.161:3001/health
```

## Функционал

### 1. Удаление префикса "Автосделка:"

При создании или изменении сделки автоматически удаляется префикс "Автосделка:" из названия:
- До: `Автосделка: Иванов Иван`
- После: `Иванов Иван`

### 2. Удаление "@" из контакта

Автоматически удаляет символ "@" в начале значения кастомного поля с ID 1018087 для всех контактов связанных со сделкой:
- До: `@username`
- После: `username`

## Архитектура

- **Очередь задач** - защита от перегрузки API и дубликатов
- **Rate limiting** - задержка 1 секунда между запросами, 5 секунд при ошибке 429
- **Задержка между контактами** - 500ms между обновлениями контактов одной сделки
- **Обработка ошибок** - логирование всех ошибок с деталями

## Переменные окружения

| Переменная | Описание | Обязательная |
|------------|----------|--------------|
| `SUBDOMAIN` | Поддомен AmoCRM | Да |
| `ACCESS_TOKEN` | Bearer токен для API | Да |
| `INTEGRATION_ID` | ID интеграции | Нет |
| `PORT` | Порт сервера | Нет (по умолчанию 3001) |

## Troubleshooting

### Webhook URL постоянно меняется
- **Решение:** Убедитесь что переменная `PORT` указана в `.env` файле или в `ecosystem.config.js`

### Ошибка 429 (Too Many Requests)
- Приложение автоматически увеличивает задержку до 5 секунд при получении этой ошибки
- Проверьте логи: `pm2 logs sdelki`

### Контакты не обновляются
- Проверьте что ID поля правильный (1018087)
- Проверьте логи на наличие ошибок API
- Убедитесь что у интеграции есть права на изменение контактов

## License

MIT
