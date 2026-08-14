@echo off
chcp 65001 >nul
title CycleSync
cd /d "%~dp0"
if not exist node_modules (
  echo מתקינה תלויות בפעם הראשונה, רגע אחד...
  call npm install
)
echo מפעילה את CycleSync...
start "" "http://localhost:3778"
node server.js
pause
