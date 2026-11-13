<?php
// Universal Gateway Router for api.vmhgroupsmr.com
$uri = $_SERVER["REQUEST_URI"] ?? "/";
$path = parse_url($uri, PHP_URL_PATH);

// 1. Direct static api-docs route
if ($path === "/api-docs" || $path === "/api-docs/" || $path === "/api-docs/index.html") {
    if (file_exists(__DIR__ . "/api-docs/index.html")) {
        header("Content-Type: text/html; charset=utf-8");
        readfile(__DIR__ . "/api-docs/index.html");
        exit;
    }
}

// 2. Direct static openapi spec route
if ($path === "/api-docs/openapi.json" || $path === "/openapi.json") {
    if (file_exists(__DIR__ . "/api-docs/openapi.json")) {
        header("Content-Type: application/json; charset=utf-8");
        readfile(__DIR__ . "/api-docs/openapi.json");
        exit;
    }
}

// 3. Route API requests
if (str_starts_with($path, "/api/") || $path === "/api" || $path === "/health") {
    require __DIR__ . "/api/index.php";
    exit;
}

// 4. Direct Redirects / Callbacks
if (str_starts_with($path, "/redirects") || str_starts_with($path, "/router") || str_starts_with($path, "/survey/callback") || str_starts_with($path, "/vendor/auth")) {
    require __DIR__ . "/api/index.php";
    exit;
}

// 5. Serve static files if they exist
$file = __DIR__ . $path;
if ($path !== "/" && is_file($file)) {
    return false; // Let webserver serve static file
}

// 6. Default: Serve Single Page App
if (file_exists(__DIR__ . "/index.html")) {
    header("Content-Type: text/html; charset=utf-8");
    readfile(__DIR__ . "/index.html");
    exit;
}
