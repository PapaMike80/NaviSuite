@echo off
rem Rigenera le stampe in stampe\ (doppio clic). Serve Python: https://www.python.org/downloads/
cd /d "%~dp0\..\.."
py -m pip install --quiet --disable-pip-version-check -r tools\stampe\requirements.txt
py tools\stampe\genera.py %*
echo.
echo Fatto: i PDF sono nella cartella stampe
pause
