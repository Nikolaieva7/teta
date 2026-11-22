<?php
/* ==================================================
   Обробник форми зворотного зв'язку → Telegram
   Токен зберігається тут, на сервері: відвідувачі сайту його не бачать
   (PHP-код виконується на хостингу і не віддається в браузер).
================================================== */

// ↓↓↓ ВПИШИ СВОЇ ДАНІ ↓↓↓
// BOT_TOKEN — токен бота від @BotFather (вигляд: 123456789:AAE...)
// CHAT_ID   — id чату, куди приходитимуть заявки (свій id можна дізнатися в @userinfobot;
//             для групи — від'ємне число, напр. -1001234567890). Спершу напиши боту /start.
const BOT_TOKEN = 'ВСТАВ_СЮДИ_BOT_TOKEN';
const CHAT_ID   = 'ВСТАВ_СЮДИ_CHAT_ID';
// ↑↑↑ ВПИШИ СВОЇ ДАНІ ↑↑↑

// Не частіше ніж одна заявка з однієї IP-адреси за стільки секунд
const RATE_LIMIT_SECONDS = 30;

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function respond(int $code, bool $ok, string $message = '', array $errors = []): void
{
    http_response_code($code);
    echo json_encode(['ok' => $ok, 'message' => $message, 'errors' => $errors], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, false, 'Метод не дозволено.');
}

// Приймаємо запити лише з власного сайту (якщо браузер передав Origin)
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host   = $_SERVER['HTTP_HOST'] ?? '';
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== parse_url('//' . $host, PHP_URL_HOST)) {
    respond(403, false, 'Заборонено.');
}

$field = static fn(string $key): string => trim((string)($_POST[$key] ?? ''));

$name    = $field('name');
$phone   = $field('phone');
$message = $field('message');

// Honeypot: бот заповнив приховане поле — вдаємо успіх, нічого не надсилаємо
if ($field('website') !== '') {
    respond(200, true);
}

// ---------- Перевірка (дублює перевірку в браузері: її легко обійти) ----------
$len = static fn(string $s): int => mb_strlen($s, 'UTF-8');
$errors = [];

if ($name === '') {
    $errors['name'] = 'Введи ім’я.';
} elseif ($len($name) < 2 || $len($name) > 50) {
    $errors['name'] = 'Ім’я має містити від 2 до 50 символів.';
} elseif (!preg_match("/^[\\p{L}'’ʼ-]+(?:\\s+[\\p{L}'’ʼ-]+)*$/u", $name)) {
    $errors['name'] = 'Ім’я може містити лише літери, пробіли та дефіс.';
}

$digits = preg_replace('/\D/', '', $phone);
if ($phone === '') {
    $errors['phone'] = 'Вкажи номер телефону.';
} elseif (!preg_match('/^\+?[\d\s()-]+$/', $phone) || strlen($digits) < 10 || strlen($digits) > 15) {
    $errors['phone'] = 'Перевір номер, напр. +380 67 123 45 67.';
}

if ($message === '') {
    $errors['message'] = 'Напиши текст звернення.';
} elseif ($len($message) < 10 || $len($message) > 2000) {
    $errors['message'] = 'Звернення має містити від 10 до 2000 символів.';
}

if ($errors) {
    respond(422, false, 'Перевір, будь ласка, виділені поля.', $errors);
}

// ---------- Захист від флуду ----------
$ip       = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$lockFile = sys_get_temp_dir() . '/cf_' . hash('sha256', $ip . __FILE__);
if (is_file($lockFile) && time() - (int)@filemtime($lockFile) < RATE_LIMIT_SECONDS) {
    respond(429, false, 'Забагато спроб. Зачекай хвилинку й спробуй ще раз.');
}

// ---------- Надсилання в Telegram ----------
$text = implode("\n", [
    '📩 Нова заявка з сайту',
    '',
    "👤 Ім’я: $name",
    "📞 Телефон: $phone",
    '',
    '💬 Звернення:',
    $message,
]);

$url     = 'https://api.telegram.org/bot' . BOT_TOKEN . '/sendMessage';
$payload = http_build_query(['chat_id' => CHAT_ID, 'text' => $text]);

if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
    ]);
    $result = curl_exec($ch);
    curl_close($ch);
} else {
    $result = @file_get_contents($url, false, stream_context_create(['http' => [
        'method'        => 'POST',
        'header'        => 'Content-Type: application/x-www-form-urlencoded',
        'content'       => $payload,
        'timeout'       => 10,
        'ignore_errors' => true,
    ]]));
}

$tg = is_string($result) ? json_decode($result, true) : null;
if (empty($tg['ok'])) {
    // Подробиці — лише в лог сервера, не відвідувачу
    error_log('Contact form → Telegram error: ' . ($tg['description'] ?? 'no response'));
    respond(502, false, 'Не вдалося надіслати. Спробуй ще раз трохи пізніше.');
}

@touch($lockFile);
respond(200, true, 'Дякую! Повідомлення надіслано — я відповім найближчим часом.');
