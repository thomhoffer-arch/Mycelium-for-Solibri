@echo off
rem One-click installer for Mycelium for Solibri (Windows).
rem Copies the app into your user profile and creates a Desktop shortcut.
setlocal
set "APPDIR=%LOCALAPPDATA%\Mycelium for Solibri"
set "EXE=mycelium-for-solibri.exe"

echo Installing Mycelium for Solibri...
if not exist "%APPDIR%" mkdir "%APPDIR%"
copy /Y "%~dp0%EXE%" "%APPDIR%\%EXE%" >nul
if errorlevel 1 (
  echo Could not copy %EXE%. Make sure it is next to this installer.
  pause
  exit /b 1
)

rem Create a Desktop shortcut via PowerShell.
powershell -NoProfile -Command ^
  "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Mycelium for Solibri.lnk');" ^
  "$s.TargetPath='%APPDIR%\%EXE%'; $s.WorkingDirectory='%APPDIR%'; $s.Save()"

echo.
echo Installed to: %APPDIR%
echo A "Mycelium for Solibri" shortcut is on your Desktop.
echo.
echo First launch creates solibri.config.json in that folder — edit it to point
echo at Solibri Desktop's REST API, then launch again.
echo.
pause
