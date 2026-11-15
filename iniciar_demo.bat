@echo off
rem Levanta Anillo y abre un enlace publico temporal para compartirlo con el jurado.
rem Requiere: .venv con las dependencias, .env con PEY_API_KEY y PANEL_KEY, y cloudflared instalado.
cd /d "%~dp0"
chcp 65001 >nul

set "LLAVE="
for /f "usebackq tokens=1,* delims==" %%a in (".env") do if /i "%%a"=="PANEL_KEY" set "LLAVE=%%b"

netstat -ano | findstr /c:":8000 " | findstr LISTENING >nul
if errorlevel 1 (
  echo Levantando el servidor en el puerto 8000...
  start "Anillo - servidor" cmd /k ".venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
  timeout /t 5 >nul
) else (
  echo El servidor ya estaba corriendo en el puerto 8000.
)

echo.
echo ==============================================================
echo  En esta computadora:  http://127.0.0.1:8000/?k=%LLAVE%
echo.
echo  Abajo va a salir un enlace https://....trycloudflare.com
echo  El enlace para el jurado es ese, terminado en:   /?k=%LLAVE%
echo  Para recibir el aviso de pey, registra en portal.pey.mx:
echo      https://....trycloudflare.com/webhooks/pey
echo  El enlace vive mientras esta ventana siga abierta.
echo ==============================================================
echo.
cloudflared tunnel --url http://127.0.0.1:8000
pause
