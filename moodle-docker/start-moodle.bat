@echo off
cd /d C:\Users\curvy\Desktop\dsc-project\moodle-docker

echo Starting Moodle...
docker compose up -d

echo.
echo Moodle is starting...
echo Open: http://localhost:8080
pause