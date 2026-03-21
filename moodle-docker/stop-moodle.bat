@echo off
cd /d C:\Users\curvy\Desktop\dsc-project\moodle-docker

echo Stopping Moodle...
docker compose down

echo Moodle stopped.
pause