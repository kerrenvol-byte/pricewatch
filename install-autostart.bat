@echo off
chcp 65001 >nul
echo יוצר קיצור דרך בתיקיית ההפעלה של Windows...
set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%STARTUP%\PriceWatch.lnk'); $s.TargetPath='%~dp0start-hidden.vbs'; $s.WorkingDirectory='%~dp0'; $s.Description='PriceWatch - מעקב מחירים אוטומטי'; $s.Save()"
if exist "%STARTUP%\PriceWatch.lnk" (
  echo.
  echo ✅ הותקן! PriceWatch יופעל אוטומטית ברקע בכל הדלקת מחשב.
  echo    הממשק תמיד זמין בכתובת: http://localhost:3777
  echo.
  echo להסרה: מחקי את הקובץ PriceWatch.lnk מהתיקייה:
  echo %STARTUP%
) else (
  echo ⚠️ משהו השתבש - נסי להריץ שוב כמנהלת מערכת
)
pause
