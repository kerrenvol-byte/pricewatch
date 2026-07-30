@echo off
chcp 65001 >nul
title PriceWatch
cd /d "%~dp0"
echo מפעיל את PriceWatch...
start "" "http://localhost:3777"
node server.js
pause
