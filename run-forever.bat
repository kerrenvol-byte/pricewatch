@echo off
rem מריץ את השרת בלולאה: אם הוא קורס - נרשם לוג והוא עולה מחדש תוך 5 שניות
cd /d "%~dp0"
rem הדפדפן של Playwright מותקן בתוך תיקיית הפרויקט (עצמאי מסביבת המשתמש)
set PLAYWRIGHT_BROWSERS_PATH=0
:loop
echo [%date% %time%] starting server >> server.log
node server.js >> server.log 2>&1
echo [%date% %time%] server exited with code %errorlevel% - restarting in 5s >> server.log
timeout /t 5 /nobreak >nul
goto loop
